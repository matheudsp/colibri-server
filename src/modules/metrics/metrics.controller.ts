import { Controller } from '@nestjs/common';
import { PrometheusController } from 'nestjs-prometheus';
import { Public } from 'src/common/decorator/public.decorator';

@Controller('/metrics')
@Public()
export class MetricsController extends PrometheusController {}
