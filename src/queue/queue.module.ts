import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EmailWorker } from './workers/email.worker';
import { redisConfig } from '../config/redis.config';
import { MailerModule } from '../mailer/mailer.module';
import { BankSlipWorker } from './workers/bank-slip.worker';
import { ChargesModule } from 'src/modules/charges/charges.module';
import { QueueName } from './jobs/jobs';
import { SignatureWorker } from './workers/signature.worker';
import { PdfsModule } from 'src/modules/pdfs/pdfs.module';
import { StorageModule } from 'src/storage/storage.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PdfWorker } from './workers/pdf.worker';

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
      { name: QueueName.CHARGE },
      { name: QueueName.SIGNATURE },
      { name: QueueName.PDF },
    ),
    MailerModule,
    ChargesModule,
    PdfsModule,
    StorageModule,
    PrismaModule,
  ],
  providers: [EmailWorker, BankSlipWorker, SignatureWorker, PdfWorker],
  exports: [BullModule],
})
export class QueueModule {}
