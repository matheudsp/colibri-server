import { Injectable, Logger } from '@nestjs/common';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly paymentsService: PaymentsOrdersService) {}

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
