import { Module } from '@nestjs/common';
import { PaymentsOrdersService } from './payments-orders.service';
import { PaymentsOrdersController } from './payments-orders.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { PaymentsSchedulerService } from './payments-orders.scheduler';
import { AsaasCustomerModule } from '../asaas-customer/asaas-customer.module';


@Module({
  imports: [PaymentGatewayModule, AsaasCustomerModule],
  providers: [
    PaymentsOrdersService,
    PrismaService,
    LogHelperService,
    PaymentsSchedulerService,
  ],
  controllers: [PaymentsOrdersController],
  exports:[PaymentsOrdersService]
})
export class PaymentsOrdersModule {}
