import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PropertiesModule } from '../properties/properties.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserModule } from '../users/users.module';
import { LogHelperService } from '../logs/log-helper.service';

@Module({
  imports: [PropertiesModule, UserModule],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService, LogHelperService],
})
export class ContractsModule {}
