import { forwardRef, Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { AppConfigModule } from 'src/config/config.module';
import { PhotosModule } from '../photos/photos.module';
import { ContractsModule } from '../contracts/contracts.module';
import { VerificationModule } from '../verification/verification.module';
import { PropertyCacheService } from './properties-cache.service';
import { PhotosPropertyService } from '../photos/photos.property.service';

@Module({
  imports: [
    AppConfigModule,
    forwardRef(() => PhotosModule),
    forwardRef(() => ContractsModule),
    VerificationModule,
  ],
  providers: [
    PropertiesService,
    PrismaService,
    LogHelperService,
    PropertyCacheService,
  ],
  controllers: [PropertiesController],
  exports: [PropertiesService, PropertyCacheService],
})
export class PropertiesModule {}
