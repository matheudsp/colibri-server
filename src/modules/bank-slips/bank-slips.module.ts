import { forwardRef, Module } from '@nestjs/common';
import { BankSlipsService } from './bank-slips.service';
import { BankSlipsController } from './bank-slips.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { AsaasCustomerModule } from '../asaas-customer/asaas-customer.module';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomerModule],
  providers: [BankSlipsService, PrismaService],
  controllers: [BankSlipsController],
  exports: [BankSlipsService],
})
export class BankSlipsModule {}
