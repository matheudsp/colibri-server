import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redisPrefix: string;

  constructor(@InjectRedis() private readonly redis: Redis) {
    // Captura o prefixo das opções do cliente Redis para uso posterior
    this.redisPrefix = this.redis.options.keyPrefix || '';
  }

  /**
   * Obtém um valor do cache e o des-serializa de JSON.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      this.logger.error(`Erro ao obter a chave '${key}' do cache`, error);
      return null;
    }
  }

  /**
   * Serializa um valor para JSON e o salva no cache com um TTL em segundos.
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      // Converte Decimal para number antes de serializar para evitar erros
      const replacer = (k: any, v: any) =>
        typeof v === 'object' && v !== null && typeof v.toNumber === 'function'
          ? v.toNumber()
          : v;
      const stringifiedValue = JSON.stringify(value, replacer);
      await this.redis.set(key, stringifiedValue, 'EX', ttlSeconds);
    } catch (error) {
      this.logger.error(`Erro ao definir a chave '${key}' no cache`, error);
    }
  }

  /**
   * Deleta chaves do cache com base em um padrão (wildcard).
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // Adiciona o prefixo ao padrão para que o `KEYS` funcione corretamente
      const fullPattern = `${this.redisPrefix}${pattern}`;
      this.logger.log(`Procurando chaves com o padrão: ${fullPattern}`);

      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) {
        // O cliente ioredis adiciona o prefixo automaticamente ao `del`
        // então precisamos remover o prefixo antes de passar as chaves.
        const keysWithoutPrefix = keys.map((key) =>
          key.replace(this.redisPrefix, ''),
        );
        await this.redis.del(keysWithoutPrefix);
        this.logger.log(
          `${keys.length} chaves limpas para o padrão '${pattern}'.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro ao deletar chaves pelo padrão '${pattern}'`,
        error,
      );
    }
  }
}
