import { forwardRef, Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { AsaasCustomersModule } from '../asaas-customers/asaas-customers.module';
import { ChargesService } from './charges.service';
import { ChargesController } from './charges.controller';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomersModule],
  providers: [ChargesService, PrismaService],
  controllers: [ChargesController],
  exports: [ChargesService],
})
export class ChargesModule {}
