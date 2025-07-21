import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from './env.validation';
import { cacheConfig } from './cache.config';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: cacheConfig,
    }),
  ],
  providers: [],
  exports: [ConfigModule, CacheModule],
})
export class AppConfigModule {}
