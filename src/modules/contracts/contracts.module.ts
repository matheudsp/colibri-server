import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PropertiesModule } from '../properties/properties.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from '../users/users.module';
import { LogHelperService } from '../logs/log-helper.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [PropertiesModule, UserModule, QueueModule],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService, LogHelperService],
})
export class ContractsModule {}
