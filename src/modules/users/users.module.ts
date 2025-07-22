import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { LogHelperService } from '../logs/log-helper.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService,LogHelperService],
  exports: [UserService],
  imports:[QueueModule]
})
export class UserModule {}
