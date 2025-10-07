import { Module } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { VerificationModule } from '../verification/verification.module';
import { LogHelperService } from '../logs/log-helper.service';
@Module({
  imports: [SubaccountsModule, PaymentGatewayModule, VerificationModule],
  providers: [BankAccountsService, PrismaService, LogHelperService],
  controllers: [BankAccountsController],
})
export class BankAccountsModule {}
