import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AsaasWebhookGuard implements CanActivate {
  private readonly logger = new Logger(AsaasWebhookGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const tokenFromHeader = request.header('asaas-access-token');

    const asaasCustomerId = request.body?.payment?.customer;

    if (!tokenFromHeader || !asaasCustomerId) {
      this.logger.warn(
        'Webhook recebido sem asaas-access-token ou payment.customer.',
      );
      throw new UnauthorizedException(
        'Token de acesso ou ID de cliente ausente.',
      );
    }

    const asaasCustomer = await this.prisma.asaasCustomer.findFirst({
      where: { asaasCustomerId: asaasCustomerId },
      include: {
        subAccount: true,
      },
    });

    if (!asaasCustomer || !asaasCustomer.subAccount?.asaasWebhookToken) {
      this.logger.warn(
        `Nenhuma subconta ou token de webhook encontrado para o Asaas Customer ID: ${asaasCustomerId}`,
      );
      throw new UnauthorizedException(
        'Subconta ou token de webhook não encontrado.',
      );
    }

    const storedToken = asaasCustomer.subAccount.asaasWebhookToken;
    const storedTokenBuffer = Buffer.from(storedToken);
    const receivedTokenBuffer = Buffer.from(tokenFromHeader);

    if (storedTokenBuffer.length !== receivedTokenBuffer.length) {
      throw new UnauthorizedException(
        'Token inválido (comprimento incorreto).',
      );
    }

    const tokensMatch = crypto.timingSafeEqual(
      storedTokenBuffer,
      receivedTokenBuffer,
    );

    if (!tokensMatch) {
      throw new UnauthorizedException('Token inválido.');
    }

    return true;
  }
}
