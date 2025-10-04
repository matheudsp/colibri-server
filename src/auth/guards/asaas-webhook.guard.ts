import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubAccount } from '@prisma/client';

// Anexa a subConta encontrada ao objeto de requisição para uso posterior
declare module 'express' {
  interface Request {
    subAccount?: SubAccount;
  }
}

@Injectable()
export class AsaasWebhookGuard implements CanActivate {
  private readonly logger = new Logger(AsaasWebhookGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const tokenFromHeader = request.header('asaas-access-token');

    this.logger.log(
      `[ASAAS WEBHOOK] Payload recebido no endpoint: ${JSON.stringify(
        request.body,
        null,
        2,
      )}`,
    );

    if (!tokenFromHeader) {
      this.logger.warn(
        '[ASAAS WEBHOOK] Requisição recebida sem o cabeçalho "asaas-access-token".',
      );
      throw new UnauthorizedException('Token de acesso do webhook ausente.');
    }

    // Busca a subconta diretamente pelo token recebido no header
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { asaasWebhookToken: tokenFromHeader },
    });

    if (!subAccount) {
      this.logger.warn(
        `[ASAAS WEBHOOK] Nenhuma subconta encontrada para o token de webhook fornecido.`,
      );
      throw new UnauthorizedException(
        'Token de webhook inválido ou não associado a nenhuma subconta.',
      );
    }

    // Anexa a subconta à requisição
    // para que o service saiba qual conta está sendo processada.
    request.subAccount = subAccount;

    this.logger.log(
      `[ASAAS WEBHOOK] Autenticado com sucesso para a subconta ${subAccount.id} (Asaas Account ID: ${subAccount.asaasAccountId}).`,
    );

    return true;
  }
}
