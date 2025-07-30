import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentsOrdersModule } from '../payments-orders/payments-orders.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [PaymentsOrdersModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PrismaService],
})
export class WebhooksModule {}
