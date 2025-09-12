import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get<number>('ASAAS_REQUEST_TIMEOUT', 15000),
        timeoutErrorMessage: 'Tempo de requisição esgotado.',
        baseURL: configService.get<string>('ASAAS_API_URL'),
        maxRedirects: 5,
      }),
    }),
  ],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
