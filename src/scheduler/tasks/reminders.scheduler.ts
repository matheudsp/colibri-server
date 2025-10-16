import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { DateUtils } from 'src/common/utils/date.utils';
import { NotificationsService } from 'src/modules/notifications/notifications.service'; // 1. Importar o serviço

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService, // 2. Injetar o serviço
  ) {}

  /**
   * Roda todo dia às 8h para enviar lembretes de faturas.
   * - D-3: Faturas que vencem em 3 dias.
   * - D+1: Faturas que venceram ontem e ainda estão pendentes/atrasadas.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'sendPaymentReminders' })
  async handleCron() {
    this.logger.log('Iniciando rotina de envio de lembretes de pagamento...');
    await this.sendUpcomingReminders(); // Lembrete D-3
    await this.sendOverdueReminders(); // Lembrete D+1
    this.logger.log('Rotina de lembretes finalizada.');
  }

  private async sendUpcomingReminders() {
    const reminderDate = addDays(new Date(), 3);
    const startDate = startOfDay(reminderDate);
    const endDate = endOfDay(reminderDate);

    const upcomingPayments = await this.prisma.paymentOrder.findMany({
      where: {
        status: PaymentStatus.PENDENTE,
        dueDate: { gte: startDate, lte: endDate },
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (upcomingPayments.length === 0) {
      this.logger.log(
        '[D-3] Nenhuma fatura com vencimento em 3 dias encontrada.',
      );
      return;
    }

    this.logger.log(
      `[D-3] Encontradas ${upcomingPayments.length} faturas. Enfileirando lembretes...`,
    );

    for (const payment of upcomingPayments) {
      const { contract, amountDue, dueDate } = payment;
      const { tenant, property } = contract;

      await this.notificationsService.create({
        userId: tenant.id,
        user: { name: tenant.name, email: tenant.email },
        title: 'Lembrete de Vencimento de Fatura',
        message: `Olá, ${tenant.name}. Sua fatura de aluguel para o imóvel "${property.title}", no valor de ${CurrencyUtils.formatCurrency(amountDue.toNumber())}, vencerá em 3 dias (${DateUtils.formatDate(dueDate)}).`,
        action: { text: 'Ver Fatura', path: `/faturas/${payment.id}` },
        sendEmail: true,
      });
    }
  }

  private async sendOverdueReminders() {
    const overdueDate = subDays(new Date(), 1);
    const startDate = startOfDay(overdueDate);
    const endDate = endOfDay(overdueDate);

    const overduePayments = await this.prisma.paymentOrder.findMany({
      where: {
        status: PaymentStatus.ATRASADO, // Busca faturas que já foram marcadas como atrasadas
        dueDate: { gte: startDate, lte: endDate },
      },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (overduePayments.length === 0) {
      this.logger.log(
        '[D+1] Nenhuma fatura vencida ontem encontrada para notificar.',
      );
      return;
    }

    this.logger.log(
      `[D+1] Encontradas ${overduePayments.length} faturas vencidas ontem. Enfileirando lembretes...`,
    );

    for (const payment of overduePayments) {
      const { contract, amountDue, dueDate } = payment;
      const { tenant, property } = contract;

      await this.notificationsService.create({
        userId: tenant.id,
        user: { name: tenant.name, email: tenant.email },
        title: '⚠️ Fatura Vencida',
        message: `Olá, ${tenant.name}. Identificamos que sua fatura de aluguel para o imóvel "${property.title}", no valor de ${CurrencyUtils.formatCurrency(amountDue.toNumber())}, venceu ontem (${DateUtils.formatDate(dueDate)}). Por favor, regularize o pagamento para evitar encargos.`,
        action: {
          text: 'Regularizar Pagamento',
          path: `/faturas/${payment.id}`,
        },
        sendEmail: true,
      });
    }
  }
}
