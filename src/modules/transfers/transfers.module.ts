import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { QueueModule } from 'src/queue/queue.module';
import { UserModule } from '../users/users.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports: [QueueModule, UserModule, PaymentGatewayModule],
  providers: [TransfersService, PrismaService],
  exports: [TransfersService],
})
export class TransfersModule {}
