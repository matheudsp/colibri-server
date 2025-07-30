import { Module } from '@nestjs/common';
import { AsaasCustomersService } from './asaas-customers.service';
import { AsaasCustomersController } from './asaas-customers.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports: [PaymentGatewayModule],
  providers: [AsaasCustomersService, PrismaService],
  controllers: [AsaasCustomersController],
  exports: [AsaasCustomersService],
})
export class AsaasCustomersModule {}
