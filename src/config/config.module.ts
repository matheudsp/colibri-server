import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from './env.validation';
import { cacheConfig } from './cache.config';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './logger.config';
import { BullModule } from '@nestjs/bull';
import { bullConfig } from './bull.config';
import { TerminusModule } from '@nestjs/terminus';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: loggerConfig,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: bullConfig,
    }),
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: cacheConfig,
    }),
    TerminusModule,
  ],
  providers: [],
  exports: [
    ConfigModule,
    TerminusModule,
    CacheModule,
    LoggerModule,
    BullModule,
  ],
})
export class AppConfigModule {}
