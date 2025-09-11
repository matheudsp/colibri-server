import { Injectable, Logger } from '@nestjs/common';
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

type TransferWithDetails = Prisma.TransferGetPayload<{
  include: {
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
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}
  /**
   * NOVO: Inicia o processo de transferência automática para o locador.
   * (Lógica movida do PaymentsOrdersService)
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
      const platformFeePercentage = 0.05;
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

  /**
   * Cria o registro da transferência no banco de dados e atualiza o status do pagamento.
   * Este método é chamado pelo PaymentsOrdersService após a solicitação de transferência.
   */
  async createTransferRecord(
    transferResponse: any,
    paymentOrderId: string,
    transferValue: number,
  ): Promise<void> {
    await this.prisma.paymentOrder.update({
      where: { id: paymentOrderId },
      data: {
        status: PaymentStatus.EM_REPASSE, // Define o status intermediário
        transfer: {
          create: {
            asaasTransferId: transferResponse.id,
            status: TransferStatus.PENDING, // Começa como pendente
            value: transferValue,
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

    if (finalPaymentStatus) {
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
        'Nenhum administrador encontrado para notificar sobre a falha na transferência.',
      );
      return;
    }

    const { paymentOrder, value, failReason, asaasTransferId } =
      transferDetails;
    const { contract } = paymentOrder;
    const { landlord, property, tenant } = contract;

    const message = `
      O repasse automático para o locador <strong>${landlord.name}</strong> falhou.<br/><br/>
      <strong>Detalhes da Transferência:</strong><br/>
      - ID da Transferência Asaas: ${asaasTransferId}<br/>
      - Imóvel: ${property.title}<br/>
      - Inquilino: ${tenant.name}<br/>
      - Valor: ${CurrencyUtils.formatCurrency(value.toNumber())}<br/>
      - Motivo da Falha: <strong>${failReason || 'Não especificado pelo gateway'}</strong><br/><br/>
      O status do pagamento foi revertido para "PAGO". É necessária uma ação manual para realizar a transferência ou investigar o problema.
    `;

    for (const admin of admins) {
      const job: NotificationJob = {
        user: { name: admin.name, email: admin.email },
        notification: {
          title: '⚠️ Falha Crítica no Repasse Automático de Aluguel',
          message: message,
        },
        action: {
          text: 'Ver Detalhes do Contrato',
          path: `/admin/contracts/${contract.id}`,
        },
      };
      await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
    }

    this.logger.log(
      `Notificações de falha na transferência ${asaasTransferId} enfileiradas para ${admins.length} administrador(es).`,
    );
  }
}
