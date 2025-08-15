import { Injectable, Logger } from '@nestjs/common';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly paymentsService: PaymentsOrdersService,
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  async processClicksignEvent(payload: any) {
    const eventName = payload?.event?.name;
    const document = payload?.document;

    if (!eventName || !document) {
      this.logger.warn(`[Webhook Clicksign] Payload inválido recebido.`);
      return;
    }

    this.logger.log(
      `[Webhook Clicksign] Evento '${eventName}' recebido para o documento ${document.key}.`,
    );

    if (eventName === 'close' || eventName === 'auto_close') {
      const documentKey = document.key;

      const pdf = await this.prisma.generatedPdf.findUnique({
        where: { clicksignDocumentKey: documentKey },
        select: { contractId: true },
      });

      if (pdf?.contractId) {
        const contractId = pdf.contractId;
        this.logger.log(
          `Contrato ${contractId} associado encontrado. Solicitando ativação...`,
        );

        await this.contractsService.activateContractAfterSignature(contractId);
      } else {
        this.logger.warn(
          `Nenhum PDF no banco de dados encontrado para a Clicksign Document Key: ${documentKey}`,
        );
      }
    }
  }

  async processAsaasEvent(payload: { event: string; payment: any }) {
    const { event, payment } = payload;

    if (!event || !payment) {
      this.logger.warn(
        '[Webhook] Payload inválido recebido, evento ou pagamento ausente.',
      );
      return;
    }

    const asaasChargeId = payment.id;
    this.logger.log(
      `[Webhook] Evento '${event}' recebido para a cobrança '${asaasChargeId}'.`,
    );

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        const amountPaid = payment.value;
        const paidAt = new Date(payment.paymentDate);
        await this.paymentsService.confirmPaymentByChargeId(
          asaasChargeId,
          amountPaid,
          paidAt,
        );
        break;

      case 'PAYMENT_OVERDUE':
        await this.paymentsService.handleOverduePayment(asaasChargeId);
        break;

      case 'PAYMENT_DELETED':
        await this.paymentsService.handleDeletedPayment(asaasChargeId);
        break;

      case 'PAYMENT_RESTORED':
        await this.paymentsService.handleRestoredPayment(asaasChargeId);
        break;

      default:
        this.logger.log(
          `[Webhook] Evento '${event}' não requer ação. Ignorando.`,
        );
        break;
    }
  }
}
