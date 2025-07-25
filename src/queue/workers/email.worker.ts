import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { MailerService } from '../../mailer/mailer.service';
import {
  EmailJobType,
  NotificationJob,
  RecoveryPasswordJob,
  type NewAccountJob,
} from '../jobs/email.job';
import { Job } from 'bull';

@Injectable()
@Processor('email')
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly mailerService: MailerService) {}

  @Process(EmailJobType.RECOVERY_PASSWORD)
  async handleRecoveryPassword(job: Job<RecoveryPasswordJob>) {
    try {
      const { email, name, token, expiresIn } = job.data;
      await this.mailerService.sendRecoveryPassword(
        { email, name },
        token,
        String(expiresIn),
      );

      this.logger.log(`E-mail de recuperação enviado para: ${email}`);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de recuperação: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  @Process(EmailJobType.NOTIFICATION)
  async handleNotification(job: Job<NotificationJob>) {
    try {
      const { user, notification, action } = job.data;
      await this.mailerService.sendNotificationEmail(
        user,
        notification,
        action,
      );
      this.logger.log(`Notificação enviada para: ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar notificação: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  @Process(EmailJobType.NEW_ACCOUNT)
  async handleNewAccount(job: Job<NewAccountJob>) {
    try {
      const { user, temporaryPassword } = job.data;
      await this.mailerService.sendNewAccountEmail(user, temporaryPassword);
      this.logger.log(
        `E-mail de boas-vindas enviado para: ${job.data.user.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de boas-vindas: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
