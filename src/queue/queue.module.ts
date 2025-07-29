import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EmailWorker } from './workers/email.worker';
import { redisConfig } from '../config/redis.config';
import { MailerModule } from '../mailer/mailer.module';
import { BankSlipWorker } from './workers/bank-slip.worker';
import { BankSlipsModule } from 'src/modules/bank-slips/bank-slips.module';
import { BankSlipsService } from 'src/modules/bank-slips/bank-slips.service';
import { QueueName } from './jobs/jobs';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: redisConfig(config).options,
      }),
    }),
    BullModule.registerQueue(
      { name: QueueName.EMAIL },
      { name: QueueName.BANK_SLIP },
    ),
    MailerModule,
    BankSlipsModule,
  ],
  providers: [EmailWorker, BankSlipWorker],
  exports: [BullModule],
})
export class QueueModule {}
