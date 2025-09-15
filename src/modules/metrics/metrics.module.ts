// src/modules/metrics/metrics.module.ts

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsProviderModule } from './metrics-provider.module';

@Module({
  imports: [MetricsProviderModule], // Garante que as métricas sejam criadas primeiro
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class MetricsModule {}
