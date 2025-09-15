import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsOrdersService } from 'src/modules/payments-orders/payments-orders.service';

@Injectable()
export class PaymentsScheduler {
  private readonly logger = new Logger(PaymentsScheduler.name);

  constructor(private readonly paymentsService: PaymentsOrdersService) {}

  /**
   * Roda todo dia para garantir que o status de pagamentos pendentes seja atualizado para atrasado.
   * Atua como um fallback caso o webhook do Asaas falhe.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM, { name: 'updateOverduePayments' })
  async handleUpdateOverduePayments() {
    this.logger.log('Iniciando verificação de pagamentos vencidos...');

    try {
      await this.paymentsService.processScheduledOverduePayments();
    } catch (error) {
      this.logger.error(
        'Falha ao executar a rotina de verificação de pagamentos vencidos.',
        error,
      );
    }
  }
}
