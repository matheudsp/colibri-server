// import {
//   Injectable,
//   CanActivate,
//   ExecutionContext,
//   UnauthorizedException,
//   Logger,
// } from '@nestjs/common';
// import { Request } from 'express';
// import { PrismaService } from 'src/prisma/prisma.service';
// import * as crypto from 'crypto';
// import { SubAccount } from '@prisma/client';

// @Injectable()
// export class AsaasWebhookGuard implements CanActivate {
//   private readonly logger = new Logger(AsaasWebhookGuard.name);

//   constructor(private readonly prisma: PrismaService) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request: Request = context.switchToHttp().getRequest();
//     this.logger.log(
//       `[ASAAS WEBHOOK PAYLOAD RECEBIDO]: ${JSON.stringify(request.body, null, 2)}`,
//     );
//     const tokenFromHeader = request.header('asaas-access-token');

//     if (!tokenFromHeader) {
//       this.logger.warn(
//         'Webhook do Asaas recebido sem o cabeçalho asaas-access-token.',
//       );
//       throw new UnauthorizedException('Token de acesso ausente.');
//     }

//     const asaasCustomerId = request.body?.payment?.customer;
//     const asaasAccountIdFromAccount = request.body?.account?.id;
//     const asaasAccountIdFromTransfer = request.body?.transfer?.account?.id;
//     const asaasAccountIdFromStatus = request.body?.accountStatus?.id; // <- O CAMPO QUE FALTAVA

//     const finalAsaasAccountId =
//       asaasAccountIdFromAccount ||
//       asaasAccountIdFromTransfer ||
//       asaasAccountIdFromStatus;

//     if (!asaasCustomerId && !finalAsaasAccountId) {
//       this.logger.warn(
//         `Webhook do Asaas sem ID válido. Nenhum dos campos esperados foi encontrado.`,
//       );
//       throw new UnauthorizedException(
//         'Identificador do cliente ou da conta ausente no payload.',
//       );
//     }

//     let subAccount: SubAccount | null = null;

//     if (asaasCustomerId) {
//       const asaasCustomer = await this.prisma.asaasCustomer.findFirst({
//         where: { asaasCustomerId: asaasCustomerId },
//         include: { subAccount: true },
//       });
//       subAccount = asaasCustomer?.subAccount ?? null;
//     } else if (finalAsaasAccountId) {
//       subAccount = await this.prisma.subAccount.findUnique({
//         where: { asaasAccountId: finalAsaasAccountId },
//       });
//     }

//     if (!subAccount || !subAccount.asaasWebhookToken) {
//       this.logger.warn(
//         `Nenhuma subconta ou token de webhook encontrado para os identificadores recebidos (Customer: ${asaasCustomerId}, Account: ${finalAsaasAccountId}).`,
//       );
//       throw new UnauthorizedException(
//         'Subconta ou token de webhook não encontrado.',
//       );
//     }

//     const storedToken = subAccount.asaasWebhookToken;
//     const storedTokenBuffer = Buffer.from(storedToken);
//     const receivedTokenBuffer = Buffer.from(tokenFromHeader);

//     if (storedTokenBuffer.length !== receivedTokenBuffer.length) {
//       throw new UnauthorizedException(
//         'Token inválido (comprimento incorreto).',
//       );
//     }

//     const tokensMatch = crypto.timingSafeEqual(
//       storedTokenBuffer,
//       receivedTokenBuffer,
//     );

//     if (!tokensMatch) {
//       throw new UnauthorizedException('Token inválido.');
//     }

//     return true;
//   }
// }
// src/auth/guards/asaas-webhook.guard.ts

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

// Adiciona a propriedade 'subAccount' ao tipo Request do Express
// para que possamos anexar a subconta encontrada.
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
      `[ASAAS WEBHOOK] Payload recebido no endpoint: ${JSON.stringify(request.body, null, 2)}`,
    );

    if (!tokenFromHeader) {
      this.logger.warn(
        '[ASAAS WEBHOOK] Requisição recebida sem o cabeçalho "asaas-access-token".',
      );
      throw new UnauthorizedException('Token de acesso do webhook ausente.');
    }

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

    request.subAccount = subAccount;

    this.logger.log(
      `[ASAAS WEBHOOK] Autenticado com sucesso para a subconta ${subAccount.id} (Asaas Account ID: ${subAccount.asaasAccountId}).`,
    );

    return true;
  }
}
