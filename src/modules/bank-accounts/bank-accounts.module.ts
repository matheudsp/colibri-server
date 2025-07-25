import { Module } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubaccountModule } from '../subaccount/subaccount.module';

@Module({
  imports: [SubaccountModule],
  providers: [BankAccountsService, PrismaService],
  controllers: [BankAccountsController],
})
export class BankAccountsModule {}
