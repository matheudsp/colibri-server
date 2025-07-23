import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { CondominiumsService } from './condominiums.service';
import { CondominiumsController } from './condominiums.controller';

@Module({
  imports: [],
  controllers: [CondominiumsController],
  providers: [CondominiumsService, PrismaService, LogHelperService],
})
export class CondominiumsModule {}
