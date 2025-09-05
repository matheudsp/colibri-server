import { forwardRef, Module } from '@nestjs/common';
import { PaymentsOrdersService } from './payments-orders.service';
import { PaymentsOrdersController } from './payments-orders.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

import { AsaasCustomersModule } from '../asaas-customers/asaas-customers.module';
import { BankSlipsModule } from '../bank-slips/bank-slips.module';
import { QueueModule } from 'src/queue/queue.module';
import { UserModule } from '../users/users.module';

@Module({
  imports: [
    PaymentGatewayModule,
    AsaasCustomersModule,
    BankSlipsModule,
    forwardRef(() => QueueModule),
    forwardRef(() => UserModule),
  ],
  providers: [PaymentsOrdersService, PrismaService, LogHelperService],
  controllers: [PaymentsOrdersController],
  exports: [PaymentsOrdersService],
})
export class PaymentsOrdersModule {}
