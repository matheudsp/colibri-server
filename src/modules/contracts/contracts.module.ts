import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PropertiesModule } from '../properties/properties.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from '../users/users.module';
import { LogHelperService } from '../logs/log-helper.service';
import { QueueModule } from 'src/queue/queue.module';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { PaymentsOrdersModule } from '../payments-orders/payments-orders.module';
import { PdfsModule } from '../pdfs/pdfs.module';
import { ClicksignModule } from '../clicksign/clicksign.module';

@Module({
  imports: [
    PropertiesModule,
    forwardRef(() => UserModule),
    forwardRef(() => QueueModule),
    PaymentGatewayModule,
    PaymentsOrdersModule,
    forwardRef(() => PdfsModule),
    ClicksignModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService, LogHelperService],
  exports: [ContractsService],
})
export class ContractsModule {}
