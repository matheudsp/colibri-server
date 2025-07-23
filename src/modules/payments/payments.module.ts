import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';

@Module({
  providers: [PaymentsService, PrismaService, LogHelperService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
