import { forwardRef, Module } from '@nestjs/common';
import { PdfsService } from './pdfs.service';
import { PdfsController } from './pdfs.controller';
import { AppConfigModule } from 'src/config/config.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { ContractsModule } from '../contracts/contracts.module';
import { StorageModule } from 'src/storage/storage.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClicksignModule } from '../clicksign/clicksign.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ContractsModule,
    StorageModule,
    ClicksignModule,
    forwardRef(() => QueueModule),
  ],
  providers: [PdfsService, LogHelperService],
  controllers: [PdfsController],
  exports: [PdfsModule, PdfsService],
})
export class PdfsModule {}
