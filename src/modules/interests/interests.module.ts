import { Module } from '@nestjs/common';
import { InterestsService } from './interests.service';
import { InterestsController } from './interests.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueModule } from 'src/queue/queue.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [QueueModule, StorageModule],
  controllers: [InterestsController],
  providers: [InterestsService, PrismaService],
})
export class InterestsModule {}
