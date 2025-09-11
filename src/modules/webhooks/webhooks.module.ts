import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentsOrdersModule } from '../payments-orders/payments-orders.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractsModule } from '../contracts/contracts.module';
import { HttpModule } from '@nestjs/axios';
import { StorageModule } from 'src/storage/storage.module';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';
import { UserModule } from '../users/users.module';
import { QueueModule } from 'src/queue/queue.module';
import { TransfersService } from '../transfers/transfers.service';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [
    PaymentsOrdersModule,
    ContractsModule,
    HttpModule,
    StorageModule,
    SubaccountsModule,
    UserModule,
    QueueModule,
    TransfersModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, PrismaService],
})
export class WebhooksModule {}
