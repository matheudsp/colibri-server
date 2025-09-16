import { Module } from '@nestjs/common';
import { PrometheusModule } from 'nestjs-prometheus';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    PrometheusModule.register({
      controller: MetricsController,
    }),
  ],
  controllers: [MetricsController],
})
export class MetricsModule {}
