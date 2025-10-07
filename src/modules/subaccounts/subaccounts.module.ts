import { forwardRef, Module } from '@nestjs/common';
import { SubaccountsController } from './subaccounts.controller';
import { SubaccountsService } from './subaccounts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { FlagsModule } from 'src/feature-flags/flags.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserModule } from '../users/users.module';
import { SubaccountsAdminController } from './subaccounts.admin.controller';
import { SubaccountsAdminService } from './subaccounts.admin.service';
import { LogModule } from '../logs/logs.module';

@Module({
  imports: [
    PaymentGatewayModule,
    FlagsModule,
    NotificationsModule,
    LogModule,
    forwardRef(() => UserModule),
  ],
  controllers: [SubaccountsController, SubaccountsAdminController],
  providers: [SubaccountsService, SubaccountsAdminService, PrismaService],
  exports: [SubaccountsService],
})
export class SubaccountsModule {}
