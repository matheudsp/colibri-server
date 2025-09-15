// src/modules/test/test.controller.ts

import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  InternalServerErrorException, // Verifique se esta importação está presente
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestService } from './test.service';
import { Public } from 'src/common/decorator/public.decorator';

@ApiTags('Test')
@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get('slow')
  @Public()
  async slowEndpoint() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { message: 'Esta resposta foi lenta de propósito.' };
  }

  @Get('error')
  @Public()
  triggerError() {
    throw new InternalServerErrorException(
      'Erro de teste para acionar o alerta.',
    );
  }
}
