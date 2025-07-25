import { Module } from '@nestjs/common';
import { BoletosService } from './boletos.service';
import { BoletosController } from './boletos.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { AsaasCustomerModule } from '../asaas-customer/asaas-customer.module';
import { QueueModule } from 'src/queue/queue.module';
import { BoletoSchedulerService } from './boleto.scheduler';

@Module({
  imports: [PaymentGatewayModule, AsaasCustomerModule, QueueModule],
  providers: [BoletosService, PrismaService, BoletoSchedulerService],
  controllers: [BoletosController],
  exports: [BoletosService],
})
export class BoletosModule {}
