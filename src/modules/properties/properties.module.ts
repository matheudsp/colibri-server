import { forwardRef, Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { AppConfigModule } from 'src/config/config.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [AppConfigModule, forwardRef(() => PhotosModule)],
  providers: [PropertiesService, PrismaService, LogHelperService],
  controllers: [PropertiesController],
  exports: [PropertiesService],
})
export class PropertiesModule {}
