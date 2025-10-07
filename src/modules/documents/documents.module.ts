import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { StorageModule } from 'src/storage/storage.module';
import { QueueModule } from 'src/queue/queue.module';
import { PdfsModule } from '../pdfs/pdfs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StorageModule, QueueModule, PdfsModule, NotificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PrismaService, LogHelperService],
})
export class DocumentsModule {}
