import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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

  @Throttle({ default: { limit: 5, ttl: 1000 } }) // Limite de 5 requisições a cada 1 segundo
  @Get('strict-throttle')
  @Public()
  testStrictThrottle() {
    return { message: 'Esta rota tem um limite de 5 requisições por segundo.' };
  }
}
