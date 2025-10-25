import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly ivLength = 16; // AES-GCM standard IV length
  private readonly tagLength = 16; // AES-GCM standard auth tag length

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('ENCRYPTION_SECRET_KEY');
    if (!secretKey || secretKey.length !== 64) {
      // Ensure key is 32 bytes (64 hex chars)
      this.logger.error(
        'ENCRYPTION_SECRET_KEY must be a 64-character hex string (32 bytes).',
      );
      throw new InternalServerErrorException(
        'Invalid encryption key configuration.',
      );
    }
    this.key = Buffer.from(secretKey, 'hex');
  }

  encrypt(text: string): string | null {
    if (text === null || text === undefined) {
      return null;
    }
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();

      // Combine IV, auth tag, and ciphertext: IV + Tag + Ciphertext
      // Store them together, often Base64 encoded for easier storage
      return Buffer.concat([iv, tag, encrypted]).toString('base64');
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`, error.stack);
      // Decide how to handle encryption errors. Throwing might stop operations.
      // Returning null might save unencrypted data or cause issues later.
      // Consider logging sensitive context carefully.
      throw new InternalServerErrorException('Failed to encrypt data.');
    }
  }

  decrypt(encryptedText: string): string | null {
    if (encryptedText === null || encryptedText === undefined) {
      return null;
    }
    try {
      const data = Buffer.from(encryptedText, 'base64');
      if (data.length < this.ivLength + this.tagLength) {
        throw new Error('Invalid encrypted data format.');
      }

      // Extract IV, auth tag, and ciphertext
      const iv = data.subarray(0, this.ivLength);
      const tag = data.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = data.subarray(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(tag); // Set the authentication tag

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`, error.stack);
      // Handle decryption errors. Returning the encrypted value might expose it.
      // Returning null might break application logic. Decide based on your security needs.
      // Avoid logging the encryptedText itself unless necessary and secured.
      // Consider returning a placeholder like "[DECRYPTION FAILED]" or throwing.
      return '[DECRYPTION FAILED]'; // Or throw new InternalServerErrorException('Failed to decrypt data.');
    }
  }
}
