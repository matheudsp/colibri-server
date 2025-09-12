import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType, NotificationJob } from 'src/queue/jobs/email.job';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { DateUtils } from 'src/common/utils/date.utils';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
  ) {}

  /**
   * Roda todo dia às 8h da manhã para enviar lembretes de faturas que vencem em 3 dias.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'sendPaymentReminders' })
  async handleCron() {
    this.logger.log(
      'Iniciando verificação de faturas com vencimento próximo...',
    );

    const reminderDate = addDays(new Date(), 3);
    const startDate = startOfDay(reminderDate);
    const endDate = endOfDay(reminderDate);

    const upcomingPayments = await this.prisma.paymentOrder.findMany({
      where: {
        status: PaymentStatus.PENDENTE,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (upcomingPayments.length === 0) {
      this.logger.log('Nenhuma fatura encontrada para envio de lembrete hoje.');
      return;
    }

    this.logger.log(
      `Encontradas ${upcomingPayments.length} faturas. Enfileirando lembretes...`,
    );

    for (const payment of upcomingPayments) {
      const { contract, amountDue, dueDate } = payment;
      const { tenant, property } = contract;

      const job: NotificationJob = {
        user: {
          name: tenant.name,
          email: tenant.email,
        },
        notification: {
          title: 'Lembrete de Vencimento de Fatura',
          message: `Olá, ${tenant.name}. Este é um lembrete amigável de que sua fatura de aluguel para o imóvel "${property.title}", no valor de ${CurrencyUtils.formatCurrency(amountDue.toNumber())}, vencerá em ${DateUtils.formatDate(dueDate)}.`,
        },
        action: {
          text: 'Ver Fatura',
          path: `/contracts/${contract.id}/payments`,
        },
      };

      await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
    }
  }
}
