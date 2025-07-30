import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsScheduler {
  private readonly logger = new Logger(PaymentsScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Roda todo dia à 1 da manhã para atualizar o status de pagamentos pendentes para atrasados.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'updateOverduePayments' })
  async handleUpdateOverduePayments() {
    this.logger.log('Iniciando verificação de pagamentos vencidos...');

    const now = new Date();
    // Pega apenas a data, zerando as horas, para comparar com o campo `dueDate`
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await this.prisma.paymentOrder.updateMany({
      where: {
        status: PaymentStatus.PENDENTE,
        dueDate: {
          lt: today, // 'lt' - less than
        },
      },
      data: {
        status: PaymentStatus.ATRASADO,
      },
    });
  }
}
