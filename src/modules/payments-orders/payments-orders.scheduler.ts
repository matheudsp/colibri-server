import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentsOrdersService } from './payments-orders.service';
import { addMonths, startOfMonth, isBefore, isAfter } from 'date-fns';

@Injectable()
export class PaymentsSchedulerService {
  private readonly logger = new Logger(PaymentsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentsOrdersService,
  ) {}

  // Executa todo dia às 6h da manhã
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateUpcomingPayments() {
    this.logger.log('Iniciando geração de boletos futuros');

    const now = new Date();
    const dueDate = startOfMonth(addMonths(now, 1)); // Primeiro dia do próximo mês

    const activeContracts = await this.prisma.contract.findMany({
      where: {
        status: 'ATIVO',
        startDate: { lte: dueDate },
        endDate: { gte: dueDate },
      },
      select: { id: true },
    });

    for (const contract of activeContracts) {
      try {
        await this.paymentService.generateMonthlyBoleto({
          contractId: contract.id,
          dueDate: dueDate.toISOString().split('T')[0],
        });
        this.logger.log(`✅ Boleto gerado para contrato ${contract.id}`);
      } catch (err) {
        this.logger.warn(
          `⚠️ Erro ao gerar boleto para contrato ${contract.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('✅ Finalizada geração automática de boletos');
  }
}
