import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentsOrdersService } from './payments-orders.service';
import {
  addMonths,
  startOfMonth,
  isBefore,
  isAfter,
  endOfMonth,
} from 'date-fns';

@Injectable()
export class PaymentsSchedulerService {
  private readonly logger = new Logger(PaymentsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentsOrdersService,
  ) {}

  // Executa todo dia às 6h da manhã
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateUpcomingPaymentsBoletos() {
    this.logger.log(
      'Iniciando geração de boletos para ordens de pagamento do próximo mês',
    );

    const now = new Date();
    const startDate = startOfMonth(addMonths(now, 1)); // Primeiro dia do próximo mês
    const endDate = endOfMonth(addMonths(now, 1)); // Último dia do próximo mês
    const pendingPaymentOrders = await this.prisma.paymentOrder.findMany({
      where: {
        status: 'PENDENTE',
        boleto: null,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
    for (const paymentOrder of pendingPaymentOrders) {
      try {
        await this.paymentService.generateBoletoForPaymentOrder(
          paymentOrder.id,
        );
        this.logger.log(
          `✅ Boleto gerado para a ordem de pagamento ${paymentOrder.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `⚠️ Erro ao gerar boleto para a ordem ${paymentOrder.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('✅ Finalizada geração automática de boletos');
  }
}
