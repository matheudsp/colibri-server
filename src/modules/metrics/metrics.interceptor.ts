import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { register, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const requestsCounter = register.getSingleMetric('http_requests_total') as
      | Counter<string>
      | undefined;
    const requestsDurationHistogram = register.getSingleMetric(
      'http_requests_duration_seconds',
    ) as Histogram<string> | undefined;

    if (!requestsCounter || !requestsDurationHistogram) {
      this.logger.warn(
        'Métricas HTTP não encontradas. A requisição não será monitorada.',
      );
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const end = requestsDurationHistogram.startTimer();
    const path = request.route?.path || request.path;

    // Ignora o endpoint de métricas
    if (path === '/metrics') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Este bloco agora só cuida de requisições bem-sucedidas
        const response = context.switchToHttp().getResponse<Response>();
        const labels = {
          method: request.method,
          status_code: response.statusCode,
          path: path,
        };
        requestsCounter.inc(labels);
        end(labels);
      }),
      catchError((error) => {
        // Este bloco cuida especificamente de requisições com erro
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;
        const labels = {
          method: request.method,
          status_code: statusCode,
          path: path,
        };
        requestsCounter.inc(labels);
        end(labels);
        // Re-lança o erro para que a aplicação continue o fluxo normal de tratamento de exceções
        return throwError(() => error);
      }),
    );
  }
}
