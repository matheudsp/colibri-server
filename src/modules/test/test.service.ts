import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType, NewAccountJob } from 'src/queue/jobs/email.job';

@Injectable()
export class TestService {
  private readonly logger = new Logger(TestService.name);

  constructor(
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async testEmailQueue() {
    const jobPayload: NewAccountJob = {
      user: {
        name: 'Matheus Tester',
        email: 'mdsp.personal@gmail.com',
      },
      temporaryPassword: 'Yo soy un bandolero donde yoy',
    };

    this.logger.log('Adicionando job de teste na fila de e-mails...');

    const job = await this.emailQueue.add(EmailJobType.NEW_ACCOUNT, jobPayload);

    this.logger.log(`Job adicionado com ID: ${job.id}`);

    return {
      message: 'Job de teste para a fila de e-mail foi adicionado com sucesso!',
      jobId: job.id,
    };
  }
}
