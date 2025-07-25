import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EmailWorker } from './workers/email.worker';
import { redisConfig } from '../config/redis.config';
import { MailerModule } from '../mailer/mailer.module';

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
      { name: 'email' },
      { name: 'boleto' },
    ),
    MailerModule,
  ],
  providers: [EmailWorker],
  exports: [BullModule],
})
export class QueueModule {}
