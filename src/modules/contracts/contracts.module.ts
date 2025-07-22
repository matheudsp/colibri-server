import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PropertiesModule } from '../properties/properties.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [PropertiesModule],
  controllers: [ContractsController],
  providers: [ContractsService, PrismaService],
})
export class ContractsModule {}
