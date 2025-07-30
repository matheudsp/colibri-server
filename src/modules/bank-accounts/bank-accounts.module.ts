import { Module } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubaccountsModule } from '../subaccounts/subaccounts.module';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';

@Module({
  imports: [SubaccountsModule, PaymentGatewayModule],
  providers: [BankAccountsService, PrismaService],
  controllers: [BankAccountsController],
})
export class BankAccountsModule {}
