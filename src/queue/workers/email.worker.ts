import { Injectable, Logger } from '@nestjs/common';
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { MailerService } from '../../mailer/mailer.service';
import {
  EmailJobType,
  NotificationJob,
  RecoveryPasswordJob,
  type EmailVerificationJob,
  type NewAccountJob,
} from '../jobs/email.job';
import { Job } from 'bull';
import { QueueName } from '../jobs/jobs';

@Injectable()
@Processor(QueueName.EMAIL)
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly mailerService: MailerService) {}
  // @OnQueueActive()
  // onActive(job: Job) {
  //   this.logger.log(
  //     `[ATIVO] Processando job ${job.id} do tipo ${job.name}. Dados: ${JSON.stringify(job.data)}`,
  //   );
  // }

  // @OnQueueCompleted()
  // onCompleted(job: Job, result: any) {
  //   this.logger.log(
  //     `[CONCLUÍDO] Job ${job.id} finalizado com resultado: ${JSON.stringify(result)}`,
  //   );
  // }

  // @OnQueueFailed()
  // onFailed(job: Job, err: Error) {
  //   this.logger.error(
  //     `[FALHA] Job ${job.id} falhou com o erro: ${err.message}`,
  //     err.stack,
  //   );
  // }

  @Process(EmailJobType.EMAIL_VERIFICATION)
  async handleEmailVerification(job: Job<EmailVerificationJob>) {
    try {
      const { email, name, token } = job.data;
      await this.mailerService.sendVerificationEmail({ email, name }, token);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de verificação: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  @Process(EmailJobType.RECOVERY_PASSWORD)
  async handleRecoveryPassword(job: Job<RecoveryPasswordJob>) {
    try {
      const { email, name, token, expiresIn } = job.data;
      await this.mailerService.sendRecoveryPassword(
        { email, name },
        token,
        String(expiresIn),
      );

      // this.logger.log(`E-mail de recuperação enviado para: ${email}`);
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
      // this.logger.log(`Notificação enviada para: ${user.email}`);
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
      // this.logger.log(`E-mail de boas-vindas sendo enviado para: ${job}`);
      const { user, temporaryPassword } = job.data;
      await this.mailerService.sendNewAccountEmail(user, temporaryPassword);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de boas-vindas: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
