import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { LogHelperService } from '../logs/log-helper.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService,LogHelperService],
  exports: [UserService],
})
export class UserModule {}
