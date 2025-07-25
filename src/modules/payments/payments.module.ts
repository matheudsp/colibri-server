import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { UserModule } from '../users/users.module';

@Module({
  imports: [PaymentGatewayModule, UserModule],
  providers: [PaymentsService, PrismaService, LogHelperService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
