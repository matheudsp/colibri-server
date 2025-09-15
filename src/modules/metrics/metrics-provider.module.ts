import { Module } from '@nestjs/common';
import { makeCounterProvider, makeHistogramProvider } from 'nestjs-prometheus';

const metricProviders = [
  makeCounterProvider({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'status_code', 'path'],
  }),
  makeHistogramProvider({
    name: 'http_requests_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'status_code', 'path'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 5],
  }),
];

@Module({
  providers: [...metricProviders],
  exports: [...metricProviders],
})
export class MetricsProviderModule {}
