import { Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { AsaasCustomersModule } from '../asaas-customers/asaas-customers.module';
import { ChargesService } from './charges.service';
import { ChargesController } from './charges.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { LogHelperService } from '../logs/log-helper.service';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomersModule, NotificationsModule],
  providers: [ChargesService, PrismaService, LogHelperService],
  controllers: [ChargesController],
  exports: [ChargesService],
})
export class ChargesModule {}
