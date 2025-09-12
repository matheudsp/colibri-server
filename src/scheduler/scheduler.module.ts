import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueueModule } from 'src/queue/queue.module';
import { BankSlipsScheduler } from './tasks/bank-slips.scheduler';
import { PaymentsScheduler } from './tasks/payments.scheduler';
import { RemindersScheduler } from './tasks/reminders.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, QueueModule],
  providers: [BankSlipsScheduler, PaymentsScheduler, RemindersScheduler],
})
export class SchedulerModule {}
