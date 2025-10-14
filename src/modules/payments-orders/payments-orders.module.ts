import { forwardRef, Module } from '@nestjs/common';
import { PaymentsOrdersService } from './payments-orders.service';
import { PaymentsOrdersController } from './payments-orders.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

import { AsaasCustomersModule } from '../asaas-customers/asaas-customers.module';
import { ChargesModule } from '../charges/charges.module';
import { QueueModule } from 'src/queue/queue.module';
import { UserModule } from '../users/users.module';
import { TransfersService } from '../transfers/transfers.service';
import { NotificationsModule } from '../notifications/notifications.module';

import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [
    PaymentGatewayModule,
    AsaasCustomersModule,
    ChargesModule,
    forwardRef(() => QueueModule),
    forwardRef(() => UserModule),
    NotificationsModule,
    forwardRef(() => ContractsModule),
  ],
  providers: [
    PaymentsOrdersService,
    PrismaService,
    LogHelperService,
    TransfersService,
  ],
  controllers: [PaymentsOrdersController],
  exports: [PaymentsOrdersService],
})
export class PaymentsOrdersModule {}
