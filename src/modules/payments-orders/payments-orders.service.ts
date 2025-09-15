import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import {
  PaymentStatus,
  TransferStatus,
  type BankAccount,
  type Contract,
  type PaymentOrder,
  type PixAddressKeyType,
  type Prisma,
  type Property,
  type SubAccount,
  type User,
} from '@prisma/client';
import { addMonths } from 'date-fns';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { Queue } from 'bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { InjectQueue } from '@nestjs/bull';
import { EmailJobType, type NotificationJob } from 'src/queue/jobs/email.job';
import { DateUtils } from 'src/common/utils/date.utils';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { FindUserPaymentsDto } from './dto/find-user-payments.dto';
import { TransfersService } from '../transfers/transfers.service';

@Injectable()
export class PaymentsOrdersService {
  private readonly logger = new Logger(PaymentsOrdersService.name);
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
    private transfersService: TransfersService,
  ) {}
  async findUserPayments(
    currentUser: JwtPayload,
    filters?: FindUserPaymentsDto,
  ) {
    const whereClause: Prisma.PaymentOrderWhereInput = {};

    whereClause.contract = {};

    if (currentUser.role === ROLES.LOCATARIO) {
      whereClause.contract.tenantId = currentUser.sub;
    } else if (currentUser.role === ROLES.LOCADOR) {
      whereClause.contract.landlordId = currentUser.sub;
    }

    if (filters?.propertyId) {
      whereClause.contract.propertyId = filters.propertyId;
    }
    if (filters?.status) {
      whereClause.status = filters.status;
    }
    if (filters?.tenantId) {
      whereClause.status = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      whereClause.dueDate = {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      };
    }

    return this.prisma.paymentOrder.findMany({
      where: whereClause,
      include: {
        bankSlip: true,
        contract: {
          select: {
            property: { select: { id: true, title: true } },
            tenant: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  async findPaymentsByContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.tenantId !== currentUser.sub &&
      contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os pagamentos deste contrato.',
      );
    }

    return this.prisma.paymentOrder.findMany({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createPaymentsForContract(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para gerar ordens de pagamento.',
      );
    }

    const existingPayments = await this.prisma.paymentOrder.count({
      where: { contractId },
    });

    if (existingPayments > 0) {
      console.log(
        `Pagamentos para o contrato ${contractId} já existem. Nenhuma ação foi tomada.`,
      );
      return;
    }

    const paymentsToCreate: Prisma.PaymentOrderCreateManyInput[] = [];
    const totalAmount =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    for (let i = 0; i < contract.durationInMonths; i++) {
      const dueDate = addMonths(contract.startDate, i + 1);
      paymentsToCreate.push({
        contractId: contract.id,
        dueDate: dueDate,
        amountDue: totalAmount,
        status: 'PENDENTE',
        paidAt: null,
      });
    }

    if (paymentsToCreate.length > 0) {
      await this.prisma.paymentOrder.createMany({
        data: paymentsToCreate,
      });
    }
  }

  async confirmPaymentByChargeId(
    asaasChargeId: string,
    amountPaid: number,
    netValue: number,
    paidAt: Date,
    transactionReceiptUrl?: string,
  ) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { asaasChargeId },
    });
    if (!bankSlip) {
      this.logger.warn(
        `Boleto com asaasChargeId ${asaasChargeId} não encontrado. Webhook ignorado.`,
      );
      return;
    }

    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: bankSlip.paymentOrderId },
    });

    if (!paymentOrder || paymentOrder.status === PaymentStatus.PAGO) {
      return;
    }

    const updatedPaymentOrder = await this.prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: PaymentStatus.PAGO,
        amountPaid,
        netValue,
        paidAt,
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { name: true, email: true } },
            landlord: {
              include: {
                bankAccount: true,
                subAccount: true,
              },
            },
          },
        },
      },
    });
    if (transactionReceiptUrl) {
      await this.prisma.bankSlip.update({
        where: { id: bankSlip.id },
        data: { transactionReceiptUrl },
      });
    }
    await this.notifyUsersOfPayment(updatedPaymentOrder);

    await this.transfersService.initiateAutomaticTransfer(updatedPaymentOrder);
  }

  async registerPayment(
    paymentId: string,
    currentUser: JwtPayload,
    registerPaymentDto: RegisterPaymentDto,
  ) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentId },
      include: { contract: true },
    });

    if (!paymentOrder) {
      throw new NotFoundException('Ordem de pagamento não encontrada.');
    }

    if (
      paymentOrder.contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para registrar pagamentos para este contrato.',
      );
    }

    const { amountPaid, paidAt } = registerPaymentDto;

    const updatedPaymentOrder = await this.prisma.paymentOrder.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAGO,
        amountPaid: amountPaid ?? paymentOrder.amountDue,
        paidAt: paidAt ?? new Date(),
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'UPDATE_STATUS_TO_PAGO',
      'PaymentOrder',
      updatedPaymentOrder.id,
    );

    return updatedPaymentOrder;
  }

  private async updatePaymentStatusByChargeId(
    asaasChargeId: string,
    status: PaymentStatus,
  ) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { asaasChargeId },
      select: { paymentOrderId: true },
    });

    if (!bankSlip) {
      this.logger.warn(
        `[Webhook] Boleto com asaasChargeId ${asaasChargeId} não encontrado. Evento de status ignorado.`,
      );
      return;
    }

    const updatedPayment = await this.prisma.paymentOrder.update({
      where: { id: bankSlip.paymentOrderId },
      data: { status },
    });

    this.logger.log(
      `[Webhook] Status do pagamento ${updatedPayment.id} atualizado para ${status}.`,
    );
  }

  /**
   * Chamado pelo webhook da Asaas quando um pagamento é marcado como vencido.
   */
  async handleOverduePayment(asaasChargeId: string) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { asaasChargeId },
      include: {
        paymentOrder: {
          include: {
            contract: {
              include: {
                property: { select: { title: true } },
                tenant: { select: { name: true, email: true } },
                landlord: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!bankSlip || !bankSlip.paymentOrder) {
      this.logger.warn(
        `[Webhook] Boleto com asaasChargeId ${asaasChargeId} ou ordem de pagamento associada não encontrado. Evento ignorado.`,
      );
      return;
    }

    await this.processOverduePayment(bankSlip.paymentOrder);
  }

  /**
   * Chamado pelo Scheduler para verificar e atualizar pagamentos vencidos.
   * Funciona como um fallback para garantir a consistência do sistema.
   */
  async processScheduledOverduePayments(): Promise<void> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const overduePayments = await this.prisma.paymentOrder.findMany({
      where: {
        status: PaymentStatus.PENDENTE,
        dueDate: {
          lt: today,
        },
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { name: true, email: true } },
            landlord: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (overduePayments.length === 0) {
      this.logger.log(
        'Nenhum pagamento pendente vencido encontrado pelo scheduler.',
      );
      return;
    }

    this.logger.log(
      `Scheduler encontrou ${overduePayments.length} pagamentos vencidos. Processando...`,
    );

    for (const payment of overduePayments) {
      await this.processOverduePayment(payment);
    }
  }
  /**
   * Lógica centralizada para processar uma ordem de pagamento como ATRASADA.
   */
  private async processOverduePayment(
    paymentOrder: PaymentOrder & {
      contract: Contract & {
        property: Pick<Property, 'title'>;
        tenant: Pick<User, 'name' | 'email'>;
        landlord: Pick<User, 'name' | 'email'>;
      };
    },
  ) {
    if (paymentOrder.status === PaymentStatus.ATRASADO) {
      this.logger.log(
        `Pagamento ${paymentOrder.id} já está com status ATRASADO. Nenhuma ação necessária.`,
      );
      return;
    }

    await this.prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: { status: PaymentStatus.ATRASADO },
    });

    this.logger.log(
      `Status do pagamento ${paymentOrder.id} atualizado para ATRASADO.`,
    );

    const { contract } = paymentOrder;

    const tenantJob: NotificationJob = {
      user: {
        email: contract.tenant.email,
        name: contract.tenant.name,
      },
      notification: {
        title: '⚠️ Lembrete: Sua Fatura de Aluguel Venceu',
        message: `Olá, ${contract.tenant.name}. Identificamos que a fatura do aluguel referente ao imóvel "${contract.property.title}", no valor de ${CurrencyUtils.formatCurrency(paymentOrder.amountDue.toNumber())}, está vencida. Para evitar encargos adicionais, por favor, regularize o pagamento o mais breve possível.`,
      },
      action: {
        text: 'Regularizar Pagamento',
        path: `/pagamentos`,
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, tenantJob);

    const landlordJob: NotificationJob = {
      user: {
        email: contract.landlord.email,
        name: contract.landlord.name,
      },
      notification: {
        title: 'Aviso: Fatura em Atraso',
        message: `Olá, ${contract.landlord.name}. A fatura de aluguel do imóvel "${contract.property.title}", com vencimento em ${DateUtils.formatDate(paymentOrder.dueDate)}, ainda não foi paga pelo inquilino ${contract.tenant.name}.`,
      },
      action: {
        text: 'Ver Detalhes',
        path: `/pagamentos`,
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, landlordJob);

    this.logger.log(
      `Notificações de fatura vencida enfileiradas para a ordem de pagamento ${paymentOrder.id}.`,
    );
  }
  async handleDeletedPayment(asaasChargeId: string) {
    await this.updatePaymentStatusByChargeId(
      asaasChargeId,
      PaymentStatus.CANCELADO,
    );
  }

  async handleRestoredPayment(asaasChargeId: string) {
    await this.updatePaymentStatusByChargeId(
      asaasChargeId,
      PaymentStatus.PENDENTE,
    );
  }

  private async notifyUsersOfPayment(paymentOrder: any) {
    const { contract } = paymentOrder;
    const formattedAmount = CurrencyUtils.formatCurrency(
      paymentOrder.amountPaid,
    );
    const formattedDueDate = DateUtils.formatDate(paymentOrder.dueDate);

    // Notificação para o Locatário (Inquilino)
    const tenantJob: NotificationJob = {
      user: {
        email: contract.tenant.email,
        name: contract.tenant.name,
      },
      notification: {
        title: 'Seu pagamento foi confirmado!',
        message: `Olá, ${contract.tenant.name}. Confirmamos o recebimento do seu pagamento de ${formattedAmount} referente ao aluguel do imóvel "${contract.property.title}", com vencimento em ${formattedDueDate}.`,
      },
      action: {
        text: 'Ver Meus Pagamentos',
        path: `/pagamentos`,
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, tenantJob);

    // Notificação para o Locador (Proprietário)
    const landlordJob: NotificationJob = {
      user: {
        email: contract.landlord.email,
        name: contract.landlord.name,
      },
      notification: {
        title: 'Pagamento Recebido!',
        message: `Olá, ${contract.landlord.name}. O pagamento de ${formattedAmount} do inquilino ${contract.tenant.name}, referente ao imóvel "${contract.property.title}" (vencimento ${formattedDueDate}), foi confirmado.`,
      },
      action: {
        text: 'Ver Extrato de Pagamentos',
        path: `/contrato/${contract.id}`,
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, landlordJob);
  }
}
