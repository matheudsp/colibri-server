import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';

import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType } from 'src/queue/jobs/email.job';
import { VerificationContext } from 'src/common/constants/verification-contexts.constant';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly OTP_TTL_SECONDS = 300; // 5 minutos

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
  ) {}

  /**
   * Gera um código OTP, armazena hash no Redis e enfileira o envio por e-mail.
   * @param userId - ID do usuário.
   * @param context - Contexto da verificação (ex: 'PIX_KEY_UPDATE').
   * @param email - E-mail do usuário para envio do código.
   */
  async generateAndSendCode(
    context: VerificationContext,
    userId: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const code = crypto
      .randomInt(0, Math.pow(10, 6))
      .toString()
      .padStart(6, '0');
    const redisKey = `verification:${user.id}:${context}`;

    try {
      // Usa um hash rápido para não armazenar o código em plain text
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

      await this.redis.set(redisKey, hashedCode, 'EX', this.OTP_TTL_SECONDS);

      await this.emailQueue.add(EmailJobType.NOTIFICATION, {
        user: { email: user.email, name: user.name },
        notification: {
          title: 'Seu Código de Verificação',
          message: `Use o seguinte código para confirmar sua ação: ${code}. Este código é válido por 5 minutos.`,
        },
      });

      this.logger.log(
        `Código para o contexto '${context}' do usuário ${user.id} gerado e enfileirado.`,
      );
      return { message: 'Código de verificação enviado para o seu e-mail.' };
    } catch (error) {
      this.logger.error(
        `Falha ao gerar ou enviar código para o usuário ${user.id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Não foi possível enviar o código de verificação.',
      );
    }
  }

  /**
   * Verifica se o código fornecido corresponde ao armazenado no Redis.
   * @param userId - ID do usuário.
   * @param context - Contexto da verificação.
   * @param code - Código de 6 dígitos fornecido pelo usuário.
   */
  async verifyCode(
    userId: string,
    context: string,
    code: string,
  ): Promise<{ actionToken: string }> {
    // Retorna o token
    const redisKey = `verification:${userId}:${context}`;
    const storedHashedCode = await this.redis.get(redisKey);

    if (!storedHashedCode) {
      throw new BadRequestException('Código expirado ou inválido.');
    }

    const providedHashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    if (storedHashedCode !== providedHashedCode) {
      throw new BadRequestException('Código inválido.');
    }

    // Remove o código OTP após o uso
    await this.redis.del(redisKey);

    // Gera e armazena o token de ação de curta duração
    const actionToken = crypto.randomUUID();
    const actionTokenKey = `action-token:${userId}:${context}`;
    await this.redis.set(actionTokenKey, actionToken, 'EX', 90); // Válido por 90 segundos

    this.logger.log(
      `Token de ação gerado para ${context} do usuário ${userId}.`,
    );

    return { actionToken };
  }

  /**
   * Valida e consome um token de ação de uso único.
   * @param token - O actionToken fornecido pelo cliente.
   * @param context - O contexto esperado para a ação.
   * @param userId - O ID do usuário que está realizando a ação.
   */
  async consumeActionToken(
    token: string,
    context: VerificationContext,
    userId: string,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('Token de ação é obrigatório.');
    }

    const actionTokenKey = `action-token:${userId}:${context}`;
    const storedToken = await this.redis.get(actionTokenKey);

    if (!storedToken) {
      throw new BadRequestException('Token de ação expirado ou inválido.');
    }

    if (storedToken !== token) {
      throw new BadRequestException('Token de ação inválido.');
    }

    await this.redis.del(actionTokenKey);

    this.logger.log(
      `Token de ação para '${context}' do usuário ${userId} foi consumido com sucesso.`,
    );
  }
}
