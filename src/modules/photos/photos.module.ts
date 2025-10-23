import { forwardRef, Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PropertiesModule } from '../properties/properties.module';
import { AppConfigModule } from 'src/config/config.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/storage/storage.module';
import { PropertyCacheService } from '../properties/properties-cache.service';
import { PhotosPropertyService } from './photos.property.service';

@Module({
  imports: [
    StorageModule,
    PrismaModule,
    AppConfigModule,
    forwardRef(() => PropertiesModule),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, PropertyCacheService, PhotosPropertyService],
  exports: [PhotosService, PhotosPropertyService, PhotosPropertyService],
})
export class PhotosModule {}
