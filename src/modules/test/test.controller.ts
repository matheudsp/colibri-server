import {
  Controller,
  Get,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Public } from 'src/common/decorator/public.decorator';
import type { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('Test')
@Controller('test')
export class TestController {
  constructor(private readonly notificationsService: NotificationsService) {}

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

  @Post('notification')
  @RequireAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dispara uma notificação de teste para o usuário logado',
  })
  async testNotification(@CurrentUser() currentUser: JwtPayload) {
    await this.notificationsService.create({
      userId: currentUser.sub,
      title: 'Notificação de Teste 🚀',
      message: `Esta é uma mensagem em tempo real enviada às ${new Date().toLocaleTimeString()}.`,
      action: {
        text: 'Ver Meus Interesses',
        path: '/interesses',
      },
      sendEmail: false,
      user: { name: 'Teste User', email: currentUser.email },
    });

    return {
      message: `Notificação de teste enviada para o usuário ${currentUser.email}`,
    };
  }
}
