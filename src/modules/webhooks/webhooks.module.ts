import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentsOrdersModule } from '../payments-orders/payments-orders.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractsModule } from '../contracts/contracts.module';
import { HttpModule } from '@nestjs/axios';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [PaymentsOrdersModule, ContractsModule, HttpModule, StorageModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PrismaService],
})
export class WebhooksModule {}
