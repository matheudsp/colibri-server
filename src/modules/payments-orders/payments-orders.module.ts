import { Module } from '@nestjs/common';
import { PaymentsOrdersService } from './payments-orders.service';
import { PaymentsOrdersController } from './payments-orders.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

import { AsaasCustomerModule } from '../asaas-customer/asaas-customer.module';
import { BankSlipsModule } from '../bank-slips/bank-slips.module';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomerModule, BankSlipsModule],
  providers: [PaymentsOrdersService, PrismaService, LogHelperService],
  controllers: [PaymentsOrdersController],
  exports: [PaymentsOrdersService],
})
export class PaymentsOrdersModule {}
