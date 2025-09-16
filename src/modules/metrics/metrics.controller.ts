import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from 'nestjs-prometheus';
import { Public } from 'src/common/decorator/public.decorator';
import { Response } from 'express';

@Controller()
@Public()
export class MetricsController extends PrometheusController {
  @Get()
  async index(@Res() response: Response) {
    return super.index(response);
  }
}
