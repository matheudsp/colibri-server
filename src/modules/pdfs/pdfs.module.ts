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
import { PdfsGeneratorService } from './pdfs.generator.service';
import { PropertiesModule } from '../properties/properties.module';
import { UserModule } from '../users/users.module';
import { PdfsSignatureService } from './pdfs.signature.service';
import { PdfsTemplateService } from './pdfs.template.service';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    forwardRef(() => ContractsModule),
    StorageModule,
    ClicksignModule,
    forwardRef(() => QueueModule),
    forwardRef(() => PropertiesModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    PdfsService,
    PdfsGeneratorService,
    PdfsSignatureService,
    PdfsTemplateService,
    LogHelperService,
    PrismaService,
  ],
  controllers: [PdfsController],
  exports: [
    PdfsService,
    PdfsGeneratorService,
    PdfsSignatureService,
    PdfsTemplateService,
  ],
})
export class PdfsModule {}
