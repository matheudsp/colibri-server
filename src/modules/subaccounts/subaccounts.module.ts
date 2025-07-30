import { Module } from '@nestjs/common';
import { SubaccountsController } from './subaccounts.controller';
import { SubaccountsService } from './subaccounts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports: [PaymentGatewayModule],
  controllers: [SubaccountsController],
  providers: [SubaccountsService, PrismaService],
  exports: [SubaccountsService],
})
export class SubaccountsModule {}
