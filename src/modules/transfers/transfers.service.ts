import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma, PaymentStatus, TransferStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from '../users/users.service';
import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType, NotificationJob } from 'src/queue/jobs/email.job';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { CreateAsaasPixTransferDto } from 'src/common/interfaces/payment-gateway.interface';
import {
  BankAccount,
  Contract,
  PaymentOrder,
  PixAddressKeyType,
  Property,
  SubAccount,
  User,
} from '@prisma/client';
import type { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import type { CreateManualTransferDto } from './dto/create-manual-transfer.dto';
import {
  TransferType,
  type SearchTransferDto,
} from './dto/search-transfer.dto';
import { LogHelperService } from '../logs/log-helper.service';
import { NotificationsService } from '../notifications/notifications.service';

type TransferWithDetails = Prisma.TransferGetPayload<{
  include: {
    user: { select: { id: true; name: true } };
    paymentOrder: {
      include: {
        contract: {
          include: {
            landlord: { select: { id: true; name: true } };
            tenant: { select: { id: true; name: true } };
            property: { select: { id: true; title: true } };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private notificationsService: NotificationsService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly logHelper: LogHelperService,
  ) {}

  /**
   * Inicia um saque manual do saldo total da subconta do usuário.
   */
  async createManualTransfer(
    currentUser: JwtPayload,
    dto: CreateManualTransferDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: { subAccount: true, bankAccount: true },
    });

    if (!user || !user.subAccount?.apiKey || !user.bankAccount) {
      throw new BadRequestException(
        'A conta não possui uma conta de pagamentos aprovada e configurada para saques. Contate o suporte.',
      );
    }

    //  Buscar o saldo atual da subconta
    const balanceData = await this.paymentGatewayService.getBalance(
      user.subAccount.apiKey,
    );
    const availableBalance = balanceData.balance;

    if (availableBalance <= 0) {
      throw new BadRequestException('Não há saldo disponível para saque.');
    }
    const MINIMUM_WITHDRAWAL_AMOUNT = 20.0;
    if (availableBalance < MINIMUM_WITHDRAWAL_AMOUNT) {
      throw new BadRequestException(
        `O valor mínimo para saque é de ${CurrencyUtils.formatCurrency(MINIMUM_WITHDRAWAL_AMOUNT)}. Seu saldo atual é de ${CurrencyUtils.formatCurrency(availableBalance)}.`,
      );
    }

    //  Criar a transferência no Asaas
    const transferPayload: CreateAsaasPixTransferDto = {
      operationType: 'PIX',
      value: availableBalance,
      pixAddressKey: user.bankAccount.pixAddressKey,
      pixAddressKeyType: user.bankAccount
        .pixAddressKeyType as PixAddressKeyType,
      description: dto.description || 'Saque manual de saldo Locaterra',
    };

    const transferResponse = await this.paymentGatewayService.createPixTransfer(
      user.subAccount.apiKey,
      transferPayload,
    );

    const newTransfer = await this.prisma.transfer.create({
      data: {
        asaasTransferId: transferResponse.id,
        status: TransferStatus.PENDING,
        value: availableBalance,
        userId: user.id,
      },
    });

    this.logger.log(
      `Saque manual ${newTransfer.id} (Asaas: ${transferResponse.id}) no valor de ${availableBalance} iniciado para o usuário ${user.id}.`,
    );
    await this.logHelper.createLog(
      currentUser.sub,
      'CREATE_MANUAL_TRANSFER',
      'Transfer',
      newTransfer.id,
    );
    return newTransfer;
  }

  /**
   *  Busca as transferências de um usuário com paginação.
   */
  async findUserTransfers(
    currentUser: JwtPayload,
    { page = 1, limit = 10, type }: SearchTransferDto,
  ) {
    if (currentUser.role !== ROLES.LOCADOR) {
      throw new ForbiddenException(
        'Apenas locadores podem visualizar o histórico de repasses.',
      );
    }

    const skip = (page - 1) * limit;

    const where: Prisma.TransferWhereInput = {
      userId: currentUser.sub,
    };
    if (type === TransferType.AUTOMATIC) {
      where.paymentOrderId = { not: null };
    } else if (type === TransferType.MANUAL) {
      where.paymentOrderId = null;
    }
    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          paymentOrder: {
            select: {
              dueDate: true,
              contract: {
                select: {
                  property: { select: { title: true } },
                  tenant: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return {
      data: transfers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Inicia o processo de transferência automática para o locador.
   */
  async initiateAutomaticTransfer(
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
  ): Promise<void> {
    const { contract } = paymentOrder;
    const { landlord } = contract;

    if (!landlord.bankAccount || !landlord.subAccount?.apiKey) {
      this.logger.warn(
        `[Repasse Automático] Locador ${landlord.id} não possui conta bancária ou subconta configurada. Repasse ignorado.`,
      );
      return;
    }

    if (paymentOrder.amountPaid === null || paymentOrder.netValue === null) {
      this.logger.error(
        `[Repasse Automático] Falha ao solicitar transferência. Valor pago ou líquido é nulo.`,
      );
      return;
    }

    try {
      const platformFeePercentage =
        (landlord.subAccount?.platformFeePercentage?.toNumber() ?? 5) / 100; // Usa 5% como padrão
      const grossAmount = paymentOrder.amountPaid.toNumber();
      const netAmountFromAsaas = paymentOrder.netValue.toNumber();
      const platformCommission = grossAmount * platformFeePercentage;
      const finalTransferAmount = netAmountFromAsaas - platformCommission;

      if (finalTransferAmount <= 0) {
        this.logger.warn(
          `[Repasse Automático] Valor final para transferência é zero ou negativo (${finalTransferAmount}). Repasse ignorado.`,
        );
        return;
      }

      const transferPayload: CreateAsaasPixTransferDto = {
        operationType: 'PIX',
        value: finalTransferAmount,
        pixAddressKey: landlord.bankAccount.pixAddressKey,
        pixAddressKeyType: landlord.bankAccount
          .pixAddressKeyType as PixAddressKeyType,
        description: `Repasse aluguel ${contract.property.title} - Inquilino: ${contract.tenant.name}`,
      };

      const transferResponse =
        await this.paymentGatewayService.createPixTransfer(
          landlord.subAccount.apiKey,
          transferPayload,
        );

      await this.createTransferRecord(
        transferResponse,
        paymentOrder.id,
        finalTransferAmount,
        landlord.id,
      );

      this.logger.log(
        `[Repasse Automático] Transferência ${transferResponse.id} criada e registrada para o locador ${landlord.id}.`,
      );
    } catch (error) {
      this.logger.error(
        `[Repasse Automático] Falha ao solicitar transferência para o locador ${landlord.id} (contrato ${contract.id}).`,
        error,
      );
      await this.notifyAdminsOfTransferFailure(paymentOrder, error);
    }
  }

  /**
   * Notifica admins sobre falha na TENTATIVA de criar a transferência.
   */
  async notifyAdminsOfTransferFailure(
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
      await this.notificationsService.create({
        userId: admin.id,
        user: admin,
        title: '⚠️ Falha no Repasse Automático de Aluguel',
        message: `Houve uma falha ao tentar realizar a transferência automática para o locador ${landlord.name} (ID: ${landlord.id}) referente ao pagamento do contrato ${contract.id}.\n\nDetalhes:\n- Imóvel: ${property.title}\n- Valor: ${CurrencyUtils.formatCurrency(paymentOrder.amountPaid?.toNumber())}\n- Erro: ${errorMessage}\n\nPor favor, verifique os logs e, se necessário, realize a transferência manualmente.`,
        sendEmail: true,
      });
    }

    this.logger.log(
      `Notificações de falha na transferência enfileiradas para ${admins.length} administrador(es).`,
    );
  }

  /**
   * Cria o registro da transferência no banco de dados e atualiza o status do pagamento.
   * Este método é chamado pelo PaymentsOrdersService após a solicitação de transferência.
   */
  async createTransferRecord(
    transferResponse: any,
    paymentOrderId: string,
    transferValue: number,
    userId: string,
  ): Promise<void> {
    await this.prisma.paymentOrder.update({
      where: { id: paymentOrderId },
      data: {
        status: PaymentStatus.EM_REPASSE,
        transfer: {
          create: {
            asaasTransferId: transferResponse.id,
            status: TransferStatus.PENDING,
            value: transferValue,
            userId: userId,
          },
        },
      },
    });
  }

  async handleTransferStatusUpdate(transferPayload: any): Promise<void> {
    const {
      id: asaasTransferId,
      status,
      effectiveDate,
      failReason,
    } = transferPayload;

    const transfer = await this.prisma.transfer.findUnique({
      where: { asaasTransferId },
    });

    if (!transfer) {
      this.logger.warn(
        `Transferência com Asaas ID ${asaasTransferId} não encontrada.`,
      );
      return;
    }

    let finalTransferStatus: TransferStatus;
    let finalPaymentStatus: PaymentStatus | null = null;

    switch (status) {
      case 'DONE':
        finalTransferStatus = TransferStatus.DONE;
        finalPaymentStatus = PaymentStatus.RECEBIDO;
        break;
      case 'FAILED':
      case 'CANCELLED':
        finalTransferStatus =
          status === 'FAILED'
            ? TransferStatus.FAILED
            : TransferStatus.CANCELLED;
        finalPaymentStatus = PaymentStatus.PAGO;
        break;
      default:
        finalTransferStatus = TransferStatus.PENDING;
    }

    const updatedTransfer = await this.prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: finalTransferStatus,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        failReason: failReason,
      },
    });

    // Só prossiga se a transferência estiver ligada a uma ordem de pagamento.
    if (finalPaymentStatus && transfer.paymentOrderId) {
      await this.prisma.paymentOrder.update({
        where: { id: transfer.paymentOrderId },
        data: { status: finalPaymentStatus },
      });
      this.logger.log(
        `Status do Pagamento ${transfer.paymentOrderId} atualizado para ${finalPaymentStatus} devido à transferência ${asaasTransferId}.`,
      );

      if (
        finalTransferStatus === TransferStatus.FAILED ||
        finalTransferStatus === TransferStatus.CANCELLED
      ) {
        const transferDetails = await this.prisma.transfer.findUnique({
          where: { id: updatedTransfer.id },
          include: {
            user: { select: { id: true, name: true } },
            paymentOrder: {
              include: {
                contract: {
                  include: {
                    landlord: { select: { id: true, name: true } },
                    tenant: { select: { id: true, name: true } },
                    property: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
        });
        if (transferDetails) {
          await this.notifyAdminsOfFailedTransfer(transferDetails);
        }
      }
    }
  }

  private async notifyAdminsOfFailedTransfer(
    transferDetails: TransferWithDetails,
  ): Promise<void> {
    const admins = await this.userService.findAdmins();
    if (admins.length === 0) {
      this.logger.warn(
        'Nenhum administrador para notificar sobre falha de transferência.',
      );
      return;
    }

    const { value, failReason, asaasTransferId, user, paymentOrder } =
      transferDetails;

    let message: string;
    let contractId: string | undefined;

    if (paymentOrder) {
      // Falha em Repasse Automático
      const { contract } = paymentOrder;
      const { property, tenant } = contract;
      contractId = contract.id;
      message = `
      O repasse automático para o locador <strong>${user.name}</strong> falhou.<br/><br/>
      <strong>Detalhes:</strong><br/>
      - Imóvel: ${property.title}<br/>
      - Inquilino: ${tenant.name}<br/>
      - Valor: ${CurrencyUtils.formatCurrency(value.toNumber())}<br/>
      - Motivo da Falha: <strong>${failReason || 'Não especificado'}</strong><br/><br/>
      O status do pagamento foi revertido para "PAGO" para nova tentativa ou ação manual.
    `;
    } else {
      // Falha em Saque Manual
      message = `
      A solicitação de saque manual do locador <strong>${user.name}</strong> falhou.<br/><br/>
      <strong>Detalhes:</strong><br/>
      - Valor Solicitado: ${CurrencyUtils.formatCurrency(value.toNumber())}<br/>
      - Motivo da Falha: <strong>${failReason || 'Não especificado'}</strong><br/><br/>
      O valor não foi debitado da subconta do usuário. Por favor, verifique o motivo.
    `;
    }

    for (const admin of admins) {
      await this.notificationsService.create({
        userId: admin.id,
        user: admin,
        title: '⚠️ Falha em Transferência Financeira',
        message: message,
        action: contractId
          ? {
              text: 'Ver Detalhes do Contrato',
              path: `/admin/contracts/${contractId}`,
            }
          : undefined,
        sendEmail: true,
      });
    }

    this.logger.log(
      `Notificações de falha na transferência ${asaasTransferId} enfileiradas para ${admins.length} administrador(es).`,
    );
  }
}
