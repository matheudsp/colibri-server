import { Module } from '@nestjs/common';
import { SubaccountController } from './subaccount.controller';
import { SubaccountService } from './subaccount.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports:[PaymentGatewayModule],
  controllers: [SubaccountController],
  providers: [SubaccountService, PrismaService],
  exports: [SubaccountService],
})
export class SubaccountModule {}
