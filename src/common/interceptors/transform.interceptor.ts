import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response as ExpressResponse, Request } from 'express';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import {
  BaseResponse,
  Metadata,
  PerformanceMetadata,
  RateLimitMetadata,
  RequestMetadata,
  ResourceMetadata,
} from '../interfaces/response';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, BaseResponse<T>>
{
  private readonly serverStartTime: number;

  constructor() {
    this.serverStartTime = performance.now();
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<BaseResponse<T>> {
    const requestStartTime = performance.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<ExpressResponse>();

    return next.handle().pipe(
      map((data: T): BaseResponse<T> => {
        const statusCode = response.statusCode;
        const message = this.getMessage(context);
        const timestamp = new Date().toISOString();

        return {
          success: true,
          statusCode,
          message,
          data: this.extractData(data),
          meta: this.buildMetadata(data, request, response, requestStartTime),
          timestamp,
        };
      }),
    );
  }

  private extractData(data: T): T {
    if (
      typeof data === 'object' &&
      data !== null &&
      'data' in data &&
      (data as Record<string, unknown>).data !== undefined
    ) {
      return (data as Record<'data', T>).data;
    }
    return data;
  }

  private buildMetadata(
    data: T,
    request: Request,
    response: ExpressResponse,
    requestStartTime: number,
  ): Metadata {
    return {
      resource: this.getResourceMetadata(data),
      performance: this.getPerformanceMetadata(requestStartTime),
      rateLimit: this.getRateLimitMetadata(response),
      request: this.getRequestMetadata(request),
    };
  }

  private getResourceMetadata(data: T): ResourceMetadata | undefined {
    const metadata: ResourceMetadata = {};

    if (
      typeof data === 'object' &&
      data !== null &&
      'meta' in data &&
      typeof (data as { meta: unknown }).meta === 'object'
    ) {
      const incomingMeta = (data as { meta: ResourceMetadata }).meta;

      if (typeof incomingMeta.count === 'number')
        metadata.count = incomingMeta.count;
      if (typeof incomingMeta.total === 'number')
        metadata.total = incomingMeta.total;
      if (typeof incomingMeta.page === 'number')
        metadata.page = incomingMeta.page;
      if (typeof incomingMeta.limit === 'number')
        metadata.limit = incomingMeta.limit;
      if (typeof incomingMeta.totalPages === 'number')
        metadata.totalPages = incomingMeta.totalPages;
    }

    if (Array.isArray(data)) {
      metadata.count = data.length;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private getPerformanceMetadata(
    requestStartTime: number,
  ): PerformanceMetadata {
    const now = performance.now();
    return {
      executionTimeMs: Math.round(now - requestStartTime),
      serverTimeMs: Math.round(now - this.serverStartTime),
    };
  }

  private getRateLimitMetadata(response: ExpressResponse): RateLimitMetadata {
    return {
      limit: this.parseHeader(response.getHeader('X-RateLimit-Limit')),
      remaining: this.parseHeader(response.getHeader('X-RateLimit-Remaining')),
      reset: this.parseHeader(response.getHeader('X-RateLimit-Reset')),
    };
  }

  private parseHeader(header: unknown): number {
    if (typeof header === 'string') return parseInt(header, 10) || 0;
    if (typeof header === 'number') return header;
    if (Array.isArray(header) && typeof header[0] === 'string')
      return parseInt(header[0], 10) || 0;
    return 0;
  }

  private getRequestMetadata(request: Request): RequestMetadata {
    return {
      requestId:
        (request as unknown as { id?: string }).id || crypto.randomUUID(),
      originIp: request.ip ?? 'unknown',
      userAgent: request.headers?.['user-agent'] ?? 'unknown',
    };
  }

  private getMessage(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<Request>();
    const responseMessages: Record<string, string> = {
      GET: 'Dados recuperados com sucesso',
      POST: 'Dados criados com sucesso',
      PUT: 'Dados atualizados com sucesso',
      DELETE: 'Dados removidos com sucesso',
    };
    return responseMessages[request.method] || 'Operação realizada com sucesso';
  }
}
