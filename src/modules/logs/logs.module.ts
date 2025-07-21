import { Global, Module } from '@nestjs/common';
import { LogController } from './logs.controller';
import { LogService } from './logs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogHelperService } from './log-helper.service';

@Global()
@Module({
  controllers: [LogController],
  providers: [LogService, PrismaService, LogHelperService],
  exports: [LogHelperService, LogService],
})
export class LogModule {}
