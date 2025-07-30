import { forwardRef, Module } from '@nestjs/common';
import { BankSlipsService } from './bank-slips.service';
import { BankSlipsController } from './bank-slips.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { AsaasCustomersModule } from '../asaas-customers/asaas-customers.module';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomersModule],
  providers: [BankSlipsService, PrismaService],
  controllers: [BankSlipsController],
  exports: [BankSlipsService],
})
export class BankSlipsModule {}
