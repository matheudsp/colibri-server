import { Module } from '@nestjs/common';
import { AsaasCustomerService } from './asaas-customer.service';
import { AsaasCustomerController } from './asaas-customer.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports:[PaymentGatewayModule],
  providers: [AsaasCustomerService, PrismaService],
  controllers: [AsaasCustomerController],
  exports: [AsaasCustomerService],
})
export class AsaasCustomerModule {}
