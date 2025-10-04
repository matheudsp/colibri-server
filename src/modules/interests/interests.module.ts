import { Module } from '@nestjs/common';
import { InterestsService } from './interests.service';
import { InterestsController } from './interests.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageModule } from 'src/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [InterestsController],
  providers: [InterestsService, PrismaService],
})
export class InterestsModule {}
