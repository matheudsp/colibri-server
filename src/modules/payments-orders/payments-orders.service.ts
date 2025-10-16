import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
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
  type Contract,
  type PaymentOrder,
  type Prisma,
  type Property,
  type User,
} from '@prisma/client';
import { addMonths } from 'date-fns';
import { RegisterPaymentDto } from './dto/register-payment.dto';

import { DateUtils } from 'src/common/utils/date.utils';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { FindUserPaymentsDto } from './dto/find-user-payments.dto';
import { TransfersService } from '../transfers/transfers.service';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractLifecycleService } from '../contracts/contracts.lifecycle.service';
import { ChargesService } from '../charges/charges.service';

@Injectable()
export class PaymentsOrdersService {
  private readonly logger = new Logger(PaymentsOrdersService.name);
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    private transfersService: TransfersService,
    private paymentGateway: PaymentGatewayService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => ContractLifecycleService))
    private contractLifecycleService: ContractLifecycleService,
    private chargesService: ChargesService,
  ) {}

  /**
   * Encontra uma PaymentOrder específica pelo ID, com verificação de permissão.
   */
  async findById(paymentOrderId: string, currentUser: JwtPayload) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        charge: true,
        contract: {
          select: {
            id: true,
            tenant: { select: { name: true, id: true } },
            landlord: { select: { name: true, id: true } },
            condoFee: true,
            rentAmount: true,
            iptuFee: true,
            property: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!paymentOrder) {
      throw new NotFoundException('Ordem de pagamento não encontrada.');
    }

    const isTenant = paymentOrder.contract.tenant.id === currentUser.sub;
    const isLandlord = paymentOrder.contract.landlord.id === currentUser.sub;
    const isAdmin = currentUser.role === ROLES.ADMIN;

    if (!isTenant && !isLandlord && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta ordem de pagamento.',
      );
    }

    return paymentOrder;
  }

  /**
   * Registra o recebimento manual (em dinheiro) do depósito caução, feito pelo locador.
   */
  async confirmSecurityDepositInCash(
    paymentOrderId: string,
    currentUser: JwtPayload,
    registerPaymentDto: RegisterPaymentDto,
  ) {
    const securityDepositOrder = await this.prisma.paymentOrder.findUnique({
      where: {
        id: paymentOrderId,
      },
      include: {
        contract: true,
      },
    });

    if (!securityDepositOrder) {
      throw new NotFoundException('Ordem de pagamento não encontrada.');
    }

    // Validação adicional para garantir que esta rota só afete a caução
    if (!securityDepositOrder.isSecurityDeposit) {
      throw new BadRequestException(
        'Esta ordem de pagamento não se refere a um depósito caução.',
      );
    }

    if (securityDepositOrder.contract.landlordId !== currentUser.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para registrar este pagamento.',
      );
    }

    if (securityDepositOrder.status !== PaymentStatus.PENDENTE) {
      throw new BadRequestException(
        `Esta cobrança de caução não está pendente (status atual: ${securityDepositOrder.status}).`,
      );
    }

    const { amountPaid, paidAt } = registerPaymentDto;
    const value = amountPaid ?? securityDepositOrder.amountDue.toNumber();
    const paymentDate = paidAt ?? new Date();

    const updatedPaymentOrder = await this.prisma.paymentOrder.update({
      where: { id: securityDepositOrder.id },
      data: {
        status: PaymentStatus.PAGO,
        amountPaid: value,
        paidAt: paymentDate,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'CONFIRM_SECURITY_DEPOSIT_CASH',
      'PaymentOrder',
      updatedPaymentOrder.id,
    );

    // Usa o contractId da ordem de pagamento para ativar o contrato
    await this.contractLifecycleService.activateContractAfterDepositPayment(
      securityDepositOrder.contractId,
    );

    this.logger.log(
      `Depósito caução para o contrato ${securityDepositOrder.contractId} foi confirmado manualmente pelo locador ${currentUser.sub}.`,
    );

    return updatedPaymentOrder;
  }

  async createAndChargeSecurityDeposit(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: { select: { title: true } },
      },
    });

    if (
      !contract ||
      !contract.securityDeposit ||
      contract.securityDeposit.toNumber() <= 0
    ) {
      throw new BadRequestException(
        'Contrato não encontrado ou sem valor de depósito caução definido.',
      );
    }
    const description = `Pagamento da Garantia (Depósito Caução) referente ao contrato do imóvel "${contract.property.title}".`;
    const dueDate = new Date();
    // Adiciona 3 dias à data atual para o vencimento
    dueDate.setDate(dueDate.getDate() + 3);
    // Cria a Ordem de Pagamento específica para a caução
    const securityDepositPaymentOrder = await this.prisma.paymentOrder.create({
      data: {
        contractId: contract.id,
        amountDue: contract.securityDeposit,
        dueDate: dueDate, // Vencimento em D+3
        status: PaymentStatus.PENDENTE,
        isSecurityDeposit: true, // Identificador
        description,
      },
    });

    await this.chargesService.generateChargeForPaymentOrder(
      securityDepositPaymentOrder.id,
      'BOLETO', // ou 'PIX' conforme regra de negócio
    );

    this.logger.log(
      `Cobrança do depósito caução gerada para o contrato ${contractId}.`,
    );
    // enviar uma notificação para o locatário informando que ele precisa pagar a caução.
  }

  async findUserPayments(
    currentUser: JwtPayload,
    filters: FindUserPaymentsDto,
  ) {
    const { page = 1, limit = 10, ...otherFilters } = filters;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.PaymentOrderWhereInput = {};
    whereClause.contract = {};

    if (currentUser.role === ROLES.LOCATARIO) {
      whereClause.contract.tenantId = currentUser.sub;
    } else if (currentUser.role === ROLES.LOCADOR) {
      whereClause.contract.landlordId = currentUser.sub;
    }

    if (otherFilters.propertyId) {
      whereClause.contract.propertyId = otherFilters.propertyId;
    }
    if (otherFilters.status) {
      whereClause.status = otherFilters.status;
    }
    if (otherFilters.tenantId) {
      whereClause.contract.tenantId = otherFilters.tenantId;
    }
    if (otherFilters.startDate || otherFilters.endDate) {
      whereClause.dueDate = {
        gte: otherFilters.startDate
          ? new Date(otherFilters.startDate)
          : undefined,
        lte: otherFilters.endDate ? new Date(otherFilters.endDate) : undefined,
      };
    }

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.paymentOrder.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          charge: true,
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
      }),
      this.prisma.paymentOrder.count({ where: whereClause }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
      include: {
        property: { select: { title: true } },
        tenant: { select: { name: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para gerar ordens de pagamento.',
      );
    }

    const existingPayments = await this.prisma.paymentOrder.count({
      where: { contractId, isSecurityDeposit: false }, // Garante que não estamos contando a caução
    });

    if (existingPayments > 0) {
      this.logger.log(
        `Pagamentos de aluguel para o contrato ${contractId} já existem. Nenhuma ação foi tomada.`,
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
      const dueDateObj = new Date(dueDate);
      const referenceMonth = (dueDateObj.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0');
      const referenceYear = dueDateObj.getUTCFullYear();
      const description = `Aluguel referente a ${referenceMonth}/${referenceYear} do imóvel "${contract.property.title}". Inquilino: ${contract.tenant.name}.`;

      paymentsToCreate.push({
        contractId: contract.id,
        dueDate: dueDate,
        amountDue: totalAmount,
        status: 'PENDENTE',
        paidAt: null,
        description,
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
    const charge = await this.prisma.charge.findUnique({
      where: { asaasChargeId },
      include: {
        paymentOrder: true,
      },
    });
    if (!charge || !charge.paymentOrder) {
      this.logger.warn(
        `Cobrança com asaasChargeId ${asaasChargeId} não encontrada. Webhook ignorado.`,
      );
      return;
    }
    const { paymentOrder } = charge;

    if (paymentOrder.status === PaymentStatus.PAGO) {
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
      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { transactionReceiptUrl },
      });
    }
    if (paymentOrder.isSecurityDeposit) {
      // Se for o pagamento da caução, ativa o contrato
      await this.contractLifecycleService.activateContractAfterDepositPayment(
        paymentOrder.contractId,
      );

      // Notifique as partes que o contrato está ativo
    } else {
      // Se for um pagamento de aluguel normal, segue o fluxo padrão
      await this.notifyUsersOfPayment(updatedPaymentOrder);
      await this.transfersService.initiateAutomaticTransfer(
        updatedPaymentOrder,
      );
    }
  }

  async confirmCashPayment(
    paymentId: string,
    currentUser: JwtPayload,
    registerPaymentDto: RegisterPaymentDto,
  ) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentId },
      include: {
        contract: {
          include: {
            landlord: {
              include: {
                subAccount: true,
              },
            },
            tenant: true,
            property: true,
          },
        },
        charge: true,
      },
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
    const value = amountPaid ?? paymentOrder.amountDue.toNumber();
    const paymentDate = paidAt ?? new Date();
    let logAction = 'CONFIRM_CASH_PAYMENT_MANUAL';

    if (
      paymentOrder.charge &&
      paymentOrder.contract.landlord.subAccount?.apiKey
    ) {
      this.logger.log(
        `Boleto ${paymentOrder.charge.asaasChargeId} encontrado. Notificando gateway sobre recebimento em dinheiro.`,
      );
      await this.paymentGateway.confirmCashPayment(
        paymentOrder.charge.asaasChargeId,
        paymentDate,
        value,
        paymentOrder.contract.landlord.subAccount.apiKey,
      );
      logAction = 'CONFIRM_CASH_PAYMENT_GATEWAY';
    } else {
      this.logger.log(
        `Nenhum boleto encontrado para a ordem de pagamento ${paymentId}. Registrando pagamento apenas localmente.`,
      );
    }

    const updatedPaymentOrder = await this.prisma.paymentOrder.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAGO,
        amountPaid: value,
        paidAt: paymentDate,
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { id: true, name: true, email: true } },
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

    await this.logHelper.createLog(
      currentUser.sub,
      logAction,
      'PaymentOrder',
      updatedPaymentOrder.id,
    );

    await this.notifyUsersOfPayment(updatedPaymentOrder);

    return updatedPaymentOrder;
  }

  private async updatePaymentStatusByChargeId(
    asaasChargeId: string,
    status: PaymentStatus,
  ) {
    const bankSlip = await this.prisma.charge.findUnique({
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
    const bankSlip = await this.prisma.charge.findUnique({
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
    if (paymentOrder.isSecurityDeposit) {
      this.logger.log(
        `Pagamento da caução ${paymentOrder.id} está vencido. Notificando o locador.`,
      );

      // Notificação para o Locador com as ações
      await this.notificationsService.create({
        userId: contract.landlordId,
        user: { email: contract.landlord.email, name: contract.landlord.name },
        title: '⚠️ Ação Necessária: Depósito Caução Não Foi Pago',
        message: `O locatário ${contract.tenant.name} não efetuou o pagamento do depósito caução para o contrato do imóvel "${contract.property.title}". O contrato não pode ser ativado. Por favor, escolha uma das opções abaixo:`,
        action: {
          text: 'Ver Ações',
          path: `/contratos/${contract.id}/acoes-caucao`,
        },
        sendEmail: true,
      });
    } else {
      // Notificação para o Inquilino
      await this.notificationsService.create({
        userId: contract.tenantId,
        user: {
          email: contract.tenant.email,
          name: contract.tenant.name,
        },
        title: '⚠️ Lembrete: Sua Fatura de Aluguel Venceu',
        message: `Olá, ${contract.tenant.name}. Identificamos que a fatura do aluguel referente ao imóvel "${contract.property.title}", no valor de ${CurrencyUtils.formatCurrency(paymentOrder.amountDue.toNumber())}, está vencida. Para evitar encargos adicionais, por favor, regularize o pagamento o mais breve possível.`,
        action: {
          text: 'Regularizar Pagamento',
          path: `/faturas`,
        },
        sendEmail: true,
      });

      // Notificação para o Locador
      await this.notificationsService.create({
        userId: contract.landlordId,
        user: {
          email: contract.landlord.email,
          name: contract.landlord.name,
        },
        title: 'Aviso: Fatura em Atraso',
        message: `Olá, ${contract.landlord.name}. A fatura de aluguel do imóvel "${contract.property.title}", com vencimento em ${DateUtils.formatDate(paymentOrder.dueDate)}, ainda não foi paga pelo inquilino ${contract.tenant.name}.`,
        action: {
          text: 'Ver Detalhes',
          path: `/faturas`,
        },
        sendEmail: true,
      });

      this.logger.log(
        `Notificações de fatura vencida enfileiradas para a ordem de pagamento ${paymentOrder.id}.`,
      );
    }
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
    await this.notificationsService.create({
      userId: contract.tenant.id,
      user: {
        email: contract.tenant.email,
        name: contract.tenant.name,
      },
      title: 'Seu pagamento foi confirmado!',
      message: `Olá, ${contract.tenant.name}. Confirmamos o recebimento do seu pagamento de ${formattedAmount} referente ao aluguel do imóvel "${contract.property.title}", com vencimento em ${formattedDueDate}.`,
      action: {
        text: 'Ver Meus Pagamentos',
        path: `/faturas`,
      },
      sendEmail: true,
    });

    // Notificação para o Locador (Proprietário)
    await this.notificationsService.create({
      userId: contract.landlord.id,
      user: {
        email: contract.landlord.email,
        name: contract.landlord.name,
      },
      title: 'Pagamento Recebido!',
      message: `Olá, ${contract.landlord.name}. O pagamento de ${formattedAmount} do inquilino ${contract.tenant.name}, referente ao imóvel "${contract.property.title}" (vencimento ${formattedDueDate}), foi confirmado.`,
      action: {
        text: 'Ver Extrato de Pagamentos',
        path: `/contratos/${contract.id}`,
      },
      sendEmail: true,
    });
  }
}
