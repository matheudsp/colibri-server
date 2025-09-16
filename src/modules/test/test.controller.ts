import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';

@ApiTags('Test')
@Controller('test')
export class TestController {
  constructor() {}

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
