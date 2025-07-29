import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BankSlipJobType } from 'src/queue/jobs/bank-slip';
import { QueueName } from 'src/queue/jobs/jobs';

@Injectable()
export class BankSlipsScheduler {
  private readonly logger = new Logger(BankSlipsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,

    @InjectQueue(QueueName.BANK_SLIP) private readonly bankSlipQueue: Queue,
  ) {}

  /**
   * Executa todo dia às 6h da manhã para enfileirar a geração de boletos do próximo mês.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'generateMonthlyBankSlips' })
  async handleCron() {
    const now = new Date();
    const startDate = startOfMonth(addMonths(now, 1));
    const endDate = endOfMonth(addMonths(now, 1));

    const pendingPaymentOrders = await this.prisma.paymentOrder.findMany({
      where: {
        status: 'PENDENTE',
        bankSlip: null,
        dueDate: { gte: startDate, lte: endDate },
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
      `Encontradas ${pendingPaymentOrders.length} ordens. Enfileirando...`,
    );

    for (const order of pendingPaymentOrders) {
      await this.bankSlipQueue.add(
        BankSlipJobType.GENERATE_MONTHLY_BANK_SLIPS,
        {
          paymentOrderId: order.id,
        },
      );
    }
  }
}
