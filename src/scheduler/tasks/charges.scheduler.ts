import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ChargeJobType } from 'src/queue/jobs/charge.job';
import { QueueName } from 'src/queue/jobs/jobs';
import { startOfToday } from 'date-fns';
import { PaymentStatus } from '@prisma/client';
@Injectable()
export class BankSlipsScheduler {
  private readonly logger = new Logger(BankSlipsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,

    @InjectQueue(QueueName.CHARGE) private readonly bankSlipQueue: Queue,
  ) {}

  /**
   * Executa todo dia às 6h da manhã para enfileirar a geração de boletos do próximo mês.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'generateMonthlyBankSlips' })
  async handleCron() {
    const today = startOfToday();

    const pendingPaymentOrders = await this.prisma.paymentOrder.findMany({
      where: {
        status: PaymentStatus.PENDENTE,
        charge: null,
        dueDate: {
          gte: today, // Garante que não pegamos faturas já vencidas
        },
      },
      select: { id: true },
    });

    if (pendingPaymentOrders.length === 0) {
      this.logger.log(
        'Nenhuma ordem de pagamento encontrada para o próximo mês.',
      );
      return;
    }

    this.logger.log(
      `Encontradas ${pendingPaymentOrders.length} ordens de pagamento. Enfileirando...`,
    );

    for (const order of pendingPaymentOrders) {
      await this.bankSlipQueue.add(ChargeJobType.GENERATE_MONTHLY_CHARGE, {
        paymentOrderId: order.id,
      });
    }
  }
}
