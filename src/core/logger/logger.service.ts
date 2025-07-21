import { Injectable, Scope } from '@nestjs/common';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  private logger!: winston.Logger;
  private context?: string;

  constructor() {
    this.initializeLogger();
  }

  private createNestFormat(): winston.Logform.Format {
    return nestWinstonModuleUtilities.format.nestLike('MyApp', {
      colors: true,
      prettyPrint: true,
    });
  }

  private initializeLogger() {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          this.createNestFormat(),
        ),
      }) as winston.transport,
    ];

    if (process.env.NODE_ENV !== 'development') {
      transports.push(
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }) as unknown as winston.transport,
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports,
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, meta?: any) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  error(message: string, trace?: string, meta?: any) {
    this.logger.error(message, {
      context: this.context,
      stack: trace,
      ...meta,
    });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  verbose(message: string, meta?: any) {
    this.logger.verbose(message, { context: this.context, ...meta });
  }
}
