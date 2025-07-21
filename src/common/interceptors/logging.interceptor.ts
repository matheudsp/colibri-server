import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

interface HasStatus {
  getStatus: () => number;
}
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    if (request.url.includes('/health')) {
      return next.handle();
    }

    const { method, originalUrl, ip, headers } = request;
    const userAgent: string =
      typeof headers['user-agent'] === 'string' ? headers['user-agent'] : '';
    const now = Date.now();

    this.logger.info({
      message: 'Incoming request',
      context: {
        type: 'HTTP',
        method,
        path: originalUrl,
        ip,
        userAgent,
      },
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode: number = response.statusCode;
          const contentLengthHeader = response.getHeader('content-length');
          const contentLength: number =
            typeof contentLengthHeader === 'string'
              ? parseInt(contentLengthHeader)
              : typeof contentLengthHeader === 'number'
                ? contentLengthHeader
                : 0;

          const duration = Date.now() - now;

          this.logger.info({
            message: 'Request completed',
            context: {
              type: 'HTTP',
              method,
              path: originalUrl,
              statusCode,
              duration,
              contentLength,
            },
          });
        },
        error: (error: unknown) => {
          const duration = Date.now() - now;

          let statusCode = 500;
          let message = 'Unknown error';
          let stack: string | undefined = undefined;

          if (
            typeof error === 'object' &&
            error !== null &&
            'getStatus' in error &&
            typeof (error as HasStatus).getStatus === 'function'
          ) {
            statusCode = (error as HasStatus).getStatus();
          }

          if (typeof error === 'object' && error !== null) {
            message = (error as { message?: string }).message ?? message;
            stack = (error as { stack?: string }).stack;
          }

          this.logger.error({
            message: 'Request failed',
            error: message,
            stack: stack,
            context: {
              type: 'HTTP',
              method,
              path: originalUrl,
              statusCode,
              duration,
            },
          });
        },
      }),
    );
  }
}
