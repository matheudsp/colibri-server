import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { loggerConfig } from 'src/config/logger.config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: loggerConfig,
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService, PinoLoggerModule],
})
export class LoggerModule {}
