import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY não está definida nas variáveis de ambiente.',
      );
    }

    if (Buffer.from(encryptionKey, 'hex').length !== 32) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hexadecimais).',
      );
    }

    this.key = Buffer.from(encryptionKey, 'hex');
  }

  /**
   * Criptografa um texto.
   * Retorna uma string no formato "iv:authTag:encryptedData"
   */
  encrypt(text: string): string | null {
    if (text === null || typeof text === 'undefined') {
      return null;
    }
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString(
      'hex',
    )}:${encrypted.toString('hex')}`;
  }

  /**
   * Descriptografa um texto no formato "iv:authTag:encryptedData"
   */
  decrypt(encryptedText: string): string | null {
    if (!encryptedText) {
      return null;
    }
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Formato de texto criptografado inválido.');
      }
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Falha ao descriptografar:', error.message); //
      return null;
    }
  }
  /**
   * Cria um hash SHA-256 determinístico.
   * O resultado é SEMPRE O MESMO para o mesmo input.
   * Use para BUSCAR dados (Índice Cego).
   */
  createSearchHash(text: string): string | null {
    if (text === null || typeof text === 'undefined') {
      return null;
    }
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
