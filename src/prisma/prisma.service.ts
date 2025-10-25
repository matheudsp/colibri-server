import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  INestApplication,
  Logger,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { EncryptionService } from '../core/encryption/encryption.service';

@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions,
    'query' | 'info' | 'warn' | 'error' // Explicit log levels
  >
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  // Defines models and fields requiring automatic encryption/decryption.

  private readonly fieldsToEncrypt: Record<string, string[]> = {
    User: ['cpfCnpj', 'phone'],
    SubAccount: ['apiKey'], // Caution: Encrypting frequently used API keys requires robust decryption handling.
    BankAccount: ['pixAddressKey'],
  };

  constructor(private readonly encryptionService: EncryptionService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    // Apply the encryption extension using $extends to this instance
    Object.assign(this, this.$extends(this.getEncryptionExtension()));
  }

  async onModuleInit() {
    this.setupQueryLogging(); // Optional detailed query logging setup

    try {
      await this.$connect();
      this.logger.log('Database connected successfully.');
    } catch (error) {
      this.logger.error('Database connection error:', error);
      process.exit(1); // Exit if connection fails
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Ensures Prisma disconnects gracefully when the NestJS app shuts down.
  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      try {
        await app.close(); // Triggers onModuleDestroy
      } catch (error) {
        this.logger.error('Error during NestJS app shutdown:', error);
        process.exit(1);
      }
    });
  }

  // Prisma Client Extension for automatic field encryption/decryption.
  private getEncryptionExtension() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this; // Capture 'this' context for use inside the extension
    return {
      name: 'fieldEncryption', // Optional: Name for debugging/logs
      query: {
        // Apply to all operations across all models
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const fields = model ? self.fieldsToEncrypt[model] : undefined;

            let processedArgs = args; // Use a mutable variable for args

            // Encrypt data before write operations
            if (
              fields &&
              [
                'create',
                'update',
                'upsert',
                'createMany',
                'updateMany',
              ].includes(operation)
            ) {
              // processWriteArgs modifies the args object directly
              processedArgs = self.processWriteArgs(processedArgs, fields);
            }

            // Execute the original Prisma operation with potentially modified args
            const result = await query(processedArgs);

            // Decrypt data after read operations or writes that return data
            if (fields && result) {
              if (
                [
                  'findUnique',
                  'findFirst',
                  'findMany',
                  'findUniqueOrThrow',
                  'findFirstOrThrow',
                  'create',
                  'update',
                  'upsert',
                ].includes(operation)
              ) {
                // Decrypt the result(s) before returning
                return Array.isArray(result)
                  ? result.map((item) => self.decryptFields(item, fields))
                  : self.decryptFields(result, fields);
              }
            }
            // Return unmodified result for operations not matching decryption criteria
            return result;
          },
        },
      },
    };
  }

  // Helper to encrypt fields within various write operation argument structures.
  private processWriteArgs(args: any, fields: string[]): any {
    // Ensure args is an object before proceeding
    if (!args || typeof args !== 'object') return args;

    // Use structured cloning for a deep copy if necessary, or shallow copy if sufficient
    const newArgs = { ...args }; // Shallow copy is often enough here

    if (newArgs.data && Array.isArray(newArgs.data)) {
      // createMany
      // Important: Ensure map returns new objects/arrays to avoid modifying original args if Prisma expects immutability
      newArgs.data = newArgs.data.map((item: Record<string, any>) =>
        this.encryptFields(item, fields),
      );
    } else if (newArgs.data && typeof newArgs.data === 'object') {
      // create, update, updateMany
      newArgs.data = this.encryptFields(newArgs.data, fields);
    }

    // Handle nested create/update within upsert
    if (newArgs.create) {
      newArgs.create = this.encryptFields(newArgs.create, fields);
    }
    if (newArgs.update) {
      newArgs.update = this.encryptFields(newArgs.update, fields);
    }

    return newArgs; // Return the potentially modified arguments
  }

  // Encrypts specified string fields within an object.
  private encryptFields<T extends Record<string, any>>(
    data: T | null | undefined,
    fields: string[],
  ): T | null | undefined {
    if (!data) return data;
    // Operate on a copy to avoid unintended side effects
    const encryptedData: Record<string, any> = { ...data };

    for (const field of fields) {
      // Check own properties to avoid issues with inherited properties
      if (Object.prototype.hasOwnProperty.call(encryptedData, field)) {
        const value = encryptedData[field];
        if (typeof value === 'string') {
          encryptedData[field] = this.encryptionService.encrypt(value);
        } else if (value !== null && value !== undefined) {
          this.logger.warn(
            `Field '${field}' in model is not a string and cannot be encrypted. Type: ${typeof value}`,
          );
        }
      }
    }
    return encryptedData as T;
  }

  // Decrypts specified string fields within an object.
  private decryptFields<T extends Record<string, any>>(
    data: T | null | undefined,
    fields: string[],
  ): T | null | undefined {
    if (!data) return data;
    // Operate on a copy
    const decryptedData: Record<string, any> = { ...data };

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(decryptedData, field)) {
        const value = decryptedData[field];
        if (typeof value === 'string') {
          // Store the result of decryption
          const decryptedValue = this.encryptionService.decrypt(value);
          decryptedData[field] = decryptedValue;
          // Log specifically if decryption itself failed (returned placeholder/null)
          if (
            decryptedValue === null ||
            decryptedValue === '[DECRYPTION FAILED]'
          ) {
            this.logger.error(
              `Decryption failed for field '${field}'. Storing placeholder/null.`,
            );
          }
        } else if (value !== null && value !== undefined) {
          this.logger.warn(
            `Field '${field}' in model result is not a string and cannot be decrypted or was not encrypted. Type: ${typeof value}`,
          );
        }
      }
    }
    return decryptedData as T;
  }

  private setupQueryLogging(): void {
    /* // Uncomment to enable detailed query logs:
    // @ts-ignore - $on is available even if not strictly typed in all extension contexts
    this.$on('query', (e: Prisma.QueryEvent) => {
      this.logger.debug(`Query: ${e.query}`);
      this.logger.debug(`Params: ${e.params}`);
      this.logger.debug(`Duration: ${e.duration} ms`);
    });
    */
  }
}
