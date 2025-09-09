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
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { CreateAsaasPixTransferDto } from 'src/common/interfaces/payment-gateway.interface';
import { UserService } from '../users/users.service';

@Injectable()
export class PaymentsOrdersService {
  private readonly logger = new Logger(PaymentsOrdersService.name);
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
    private paymentGatewayService: PaymentGatewayService,
    private userService: UserService,
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

    return this.prisma.paymentOrder.findMany({
      where: whereClause,
      include: {
        bankSlip: true,
        contract: {
          select: {
            property: { select: { title: true, id: true } },
            tenant: { select: { name: true } },
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
    await this.notifyUsersOfPayment(updatedPaymentOrder);

    await this.initiateAutomaticTransfer(updatedPaymentOrder);
  }

  /**
   * Inicia a transferência automática para o locador após um pagamento ser recebido.
   * @param paymentOrder - A ordem de pagamento, incluindo o contrato e dados do locador.
   */
  private async initiateAutomaticTransfer(
    paymentOrder: PaymentOrder & {
      contract: Contract & {
        property: Pick<Property, 'title'>;
        tenant: Pick<User, 'name' | 'email'>;
        landlord: User & {
          bankAccount: BankAccount | null;
          subAccount: SubAccount | null;
        };
      };
    },
  ) {
    const { contract } = paymentOrder;
    const { landlord } = contract;

    if (!landlord.bankAccount || !landlord.subAccount?.apiKey) {
      this.logger.warn(
        `[Repasse Automático] Locador ${landlord.id} não possui conta bancária ou subconta configurada. Repasse ignorado.`,
      );
      return;
    }

    if (
      paymentOrder.amountPaid === null ||
      paymentOrder.netValue === null || // Adicionada verificação para netValue
      paymentOrder.amountPaid === undefined ||
      paymentOrder.netValue === undefined
    ) {
      this.logger.error(
        `[Repasse Automático] Falha ao solicitar transferência para o locador ${landlord.id}. O valor pago (amountPaid) ou líquido (netValue) é nulo.`,
      );
      return;
    }

    try {
      const platformFeePercentage = 0.05; // 5% de comissão da plataforma
      const grossAmount = paymentOrder.amountPaid.toNumber();
      const netAmountFromAsaas = paymentOrder.netValue.toNumber();

      // Calcula a comissão da plataforma baseada no valor BRUTO
      const platformCommission = grossAmount * platformFeePercentage;

      // O valor final a ser transferido é o valor líquido (após taxa Asaas) MENOS a comissão da plataforma
      const finalTransferAmount = netAmountFromAsaas - platformCommission;

      if (finalTransferAmount <= 0) {
        this.logger.warn(
          `[Repasse Automático] Valor final para transferência para o locador ${landlord.id} é zero ou negativo (${finalTransferAmount}). Repasse ignorado.`,
        );
        return;
      }

      const transferPayload: CreateAsaasPixTransferDto = {
        operationType: 'PIX',
        value: finalTransferAmount, // <-- USAR O VALOR FINAL CALCULADO
        pixAddressKey: landlord.bankAccount.pixAddressKey,
        pixAddressKeyType: landlord.bankAccount
          .pixAddressKeyType as PixAddressKeyType,
        description: `Repasse aluguel ${contract.property.title} - Inquilino: ${contract.tenant.name}`,
      };

      await this.paymentGatewayService.createPixTransfer(
        landlord.subAccount.apiKey,
        transferPayload,
      );

      await this.prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: { status: PaymentStatus.RECEBIDO },
      });

      this.logger.log(
        `[Repasse Automático] Transferência PIX de R$ ${finalTransferAmount.toFixed(2)} para o locador ${landlord.id} solicitada com sucesso.`,
      );
    } catch (error) {
      this.logger.error(
        `[Repasse Automático] Falha ao solicitar transferência para o locador ${landlord.id} (contrato ${contract.id}).`,
        error,
      );
      await this.notifyAdminsOfTransferFailure(paymentOrder, error);
    }
  }

  private async notifyAdminsOfTransferFailure(
    paymentOrder: PaymentOrder & {
      contract: Contract & {
        property: Pick<Property, 'title'>;
        tenant: Pick<User, 'name' | 'email'>;
        landlord: User & {
          bankAccount: BankAccount | null;
          subAccount: SubAccount | null;
        };
      };
    },
    error: unknown,
  ) {
    const admins = await this.userService.findAdmins();
    if (admins.length === 0) {
      this.logger.warn(
        'Nenhum administrador ativo encontrado para notificar sobre a falha na transferência.',
      );
      return;
    }

    const { contract } = paymentOrder;
    const { landlord, property } = contract;
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';

    for (const admin of admins) {
      const job: NotificationJob = {
        user: {
          name: admin.name,
          email: admin.email,
        },
        notification: {
          title: '⚠️ Falha no Repasse Automático de Aluguel',
          message: `Houve uma falha ao tentar realizar a transferência automática para o locador ${landlord.name} (ID: ${landlord.id}) referente ao pagamento do contrato ${contract.id}.\n\nDetalhes:\n- Imóvel: ${property.title}\n- Valor: ${CurrencyUtils.formatCurrency(
            paymentOrder.amountPaid?.toNumber(),
          )}\n- Erro: ${errorMessage}\n\nPor favor, verifique os logs e, se necessário, realize a transferência manualmente.`,
        },
        // action: {
        //   text: 'Ver Contrato',
        //   path: `/contracts/${contract.id}`,
        // },
      };

      await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
    }

    this.logger.log(
      `Notificações de falha na transferência enfileiradas para ${admins.length} administrador(es).`,
    );
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

  async handleOverduePayment(asaasChargeId: string) {
    await this.updatePaymentStatusByChargeId(
      asaasChargeId,
      PaymentStatus.ATRASADO,
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
        path: `/contracts/${contract.id}/payments`,
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
        path: `/contracts/${contract.id}/payments`,
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, landlordJob);
  }
}
