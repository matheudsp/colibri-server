import { forwardRef, Module } from '@nestjs/common';
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
import { StorageModule } from 'src/storage/storage.module';
import { ContractLifecycleService } from './contracts.lifecycle.service';
import { ContractSignatureService } from './contracts.signature.service';
import { ContractPaymentService } from './contracts.payment.service';
import { ChargesModule } from '../charges/charges.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => PropertiesModule),
    forwardRef(() => UserModule),
    forwardRef(() => QueueModule),
    PaymentGatewayModule,
    forwardRef(() => PaymentsOrdersModule),
    forwardRef(() => PdfsModule),
    ChargesModule,
    ClicksignModule,
    StorageModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ContractLifecycleService,
    ContractSignatureService,
    ContractPaymentService,
    PrismaService,
    LogHelperService,
  ],
  exports: [
    ContractsService,
    ContractLifecycleService,
    ContractSignatureService,
    ContractPaymentService,
  ],
})
export class ContractsModule {}
