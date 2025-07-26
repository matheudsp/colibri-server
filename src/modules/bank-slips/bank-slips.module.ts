import { Module } from '@nestjs/common';
import { BankSlipsService } from './bank-slips.service';
import { BankSlipsController } from './bank-slips.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { AsaasCustomerModule } from '../asaas-customer/asaas-customer.module';
import { QueueModule } from 'src/queue/queue.module';
import { BankSlipsSchedulerService } from './bank-slips.scheduler';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomerModule, QueueModule],
  providers: [BankSlipsService, PrismaService, BankSlipsSchedulerService],
  controllers: [BankSlipsController],
  exports: [BankSlipsService],
})
export class BankSlipsModule {}
