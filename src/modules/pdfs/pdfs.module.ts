import { Module } from '@nestjs/common';
import { PdfsService } from './pdfs.service';
import { PdfsController } from './pdfs.controller';

@Module({
  providers: [PdfsService],
  controllers: [PdfsController]
})
export class PdfsModule {}
