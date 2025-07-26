import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BankSlipsSchedulerService {
  private readonly logger = new Logger(BankSlipsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('bank-slip') private readonly boletoQueue: Queue,
  ) {}

  // Executa todo dia às 6h da manhã
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateUpcomingPaymentsBoletos() {
    this.logger.log(
      'Iniciando busca por ordens de pagamento do próximo mês para enfileirar.',
    );

    const now = new Date();
    const startDate = startOfMonth(addMonths(now, 1));
    const endDate = endOfMonth(addMonths(now, 1));

    const pendingPaymentOrders = await this.prisma.paymentOrder.findMany({
      where: {
        status: 'PENDENTE',
        bankSlip: null,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
      },
    });

    if (pendingPaymentOrders.length === 0) {
      this.logger.log(
        'Nenhuma ordem de pagamento encontrada para o próximo mês.',
      );
      return;
    }

    this.logger.log(
      `Encontradas ${pendingPaymentOrders.length} ordens. Injetando na fila...`,
    );

    for (const paymentOrder of pendingPaymentOrders) {
      await this.boletoQueue.add(
        'generate-boleto',
        { paymentOrderId: paymentOrder.id },
        {
          attempts: 3, // Tenta até 3 vezes em caso de falha
          backoff: {
            type: 'exponential',
            delay: 1000 * 60, // Tenta novamente após 1 minuto, depois 2, 4 minutos
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }

    this.logger.log(
      'Todas as ordens de pagamento foram enfileiradas para geração de boletos.',
    );
  }
}
