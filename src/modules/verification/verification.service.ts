import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';
import Redis from 'ioredis';

import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType } from 'src/queue/jobs/email.job';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly OTP_TTL_SECONDS = 300; // 5 minutos

  constructor(
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
    userId: string,
    context: string,
    email: string,
    userName: string,
  ): Promise<{ message: string }> {
    const code = crypto
      .randomInt(0, Math.pow(10, 6))
      .toString()
      .padStart(6, '0');
    const redisKey = `verification:${userId}:${context}`;

    try {
      // Usa um hash rápido para não armazenar o código em plain text
      const hashedCode = await crypto
        .createHash('sha256')
        .update(code)
        .digest('hex');

      await this.redis.set(redisKey, hashedCode, 'EX', this.OTP_TTL_SECONDS);

      await this.emailQueue.add(EmailJobType.NOTIFICATION, {
        user: { email, name: userName },
        notification: {
          title: 'Seu Código de Verificação',
          message: `Use o seguinte código para confirmar sua ação: ${code}. Este código é válido por 5 minutos.`,
        },
      });

      this.logger.log(
        `Código para o contexto '${context}' do usuário ${userId} gerado e enfileirado.`,
      );
      return { message: 'Código de verificação enviado para o seu e-mail.' };
    } catch (error) {
      this.logger.error(
        `Falha ao gerar ou enviar código para o usuário ${userId}`,
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
  ): Promise<{ success: boolean; actionToken: string }> {
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

    return { success: true, actionToken };
  }
}
