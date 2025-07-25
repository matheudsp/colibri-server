import { Module } from '@nestjs/common';
import { PaymentsOrdersService } from './payments-orders.service';
import { PaymentsOrdersController } from './payments-orders.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { UserModule } from '../users/users.module';

@Module({
  imports: [PaymentGatewayModule, UserModule],
  providers: [PaymentsOrdersService, PrismaService, LogHelperService],
  controllers: [PaymentsOrdersController],
})
export class PaymentsOrdersModule {}
