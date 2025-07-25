import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
