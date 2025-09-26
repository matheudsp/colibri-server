import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueueModule } from 'src/queue/queue.module';
import { BankSlipsScheduler } from './tasks/bank-slips.scheduler';
import { PaymentsScheduler } from './tasks/payments.scheduler';
import { RemindersScheduler } from './tasks/reminders.scheduler';
import { PaymentsOrdersModule } from 'src/modules/payments-orders/payments-orders.module';
import { PdfsScheduler } from './tasks/pdfs.scheduler';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    PaymentsOrdersModule,
    StorageModule,
  ],
  providers: [
    BankSlipsScheduler,
    PaymentsScheduler,
    RemindersScheduler,
    PdfsScheduler,
  ],
})
export class SchedulerModule {}
