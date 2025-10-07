import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { QueueModule } from 'src/queue/queue.module';
import { UserModule } from '../users/users.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { TransfersController } from './transfers.controller';
import { LogHelperService } from '../logs/log-helper.service';

@Module({
  imports: [QueueModule, UserModule, PaymentGatewayModule],
  controllers: [TransfersController],
  providers: [TransfersService, PrismaService, LogHelperService],
  exports: [TransfersService],
})
export class TransfersModule {}
