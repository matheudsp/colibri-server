import { forwardRef, Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PropertiesModule } from '../properties/properties.module';
import { AppConfigModule } from 'src/config/config.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [
    StorageModule,
    PrismaModule,
    AppConfigModule,
    forwardRef(() => PropertiesModule),
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
