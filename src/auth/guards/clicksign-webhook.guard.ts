import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class ClicksignWebhookGuard implements CanActivate {
  private readonly logger = new Logger(ClicksignWebhookGuard.name);
  private readonly hmacSecret: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.getOrThrow<string>(
      'CLICKSIGN_HMAC_SECRET',
    );
    this.hmacSecret = Buffer.from(secret, 'utf8');
  }

  canActivate(context: ExecutionContext): boolean {
    const request: Request & { rawBody: Buffer } = context
      .switchToHttp()
      .getRequest();
    const hmacHeader = request.header('Content-Hmac');

    if (!hmacHeader) {
      this.logger.warn(
        '[Webhook Clicksign] Requisição recebida sem o cabeçalho Content-Hmac.',
      );
      throw new UnauthorizedException('Assinatura HMAC ausente.');
    }

    // O corpo da requisição precisa ser o buffer original (raw)
    if (!request.rawBody) {
      this.logger.error(
        '[Webhook Clicksign] Raw body não está disponível na requisição. Verifique se o json-parser está configurado para incluí-lo.',
      );
      throw new Error('Raw body da requisição não encontrado.');
    }

    const expectedSignature = `sha256=${crypto.createHmac('sha256', this.hmacSecret).update(request.rawBody).digest('hex')}`;

    if (
      !crypto.timingSafeEqual(
        Buffer.from(hmacHeader),
        Buffer.from(expectedSignature),
      )
    ) {
      this.logger.warn(
        `[Webhook Clicksign] Assinatura HMAC inválida. Recebido: ${hmacHeader}`,
      );
      throw new UnauthorizedException('Assinatura HMAC inválida.');
    }

    return true;
  }
}
