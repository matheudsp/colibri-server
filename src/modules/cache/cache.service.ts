import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redisPrefix: string;

  constructor(@InjectRedis() private readonly redis: Redis) {
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
   * Serializa um valor e o salva no cache, rastreando a chave em uma lista.
   */
  async set(
    key: string,
    value: any,
    ttlSeconds: number,
    listKey?: string,
  ): Promise<void> {
    try {
      const replacer = (k: any, v: any) =>
        typeof v === 'object' && v !== null && typeof v.toNumber === 'function'
          ? v.toNumber()
          : v;
      const stringifiedValue = JSON.stringify(value, replacer);

      // Usamos uma transação para garantir que ambas as operações sejam executadas
      const multi = this.redis.multi();
      multi.set(key, stringifiedValue, 'EX', ttlSeconds);
      if (listKey) {
        multi.sadd(listKey, key); // Adiciona a chave ao set de rastreamento
      }
      await multi.exec();
    } catch (error) {
      this.logger.error(`Erro ao definir a chave '${key}' no cache`, error);
    }
  }

  /**
   * Deleta todas as chaves rastreadas em um set específico.
   */
  async delFromList(listKey: string): Promise<void> {
    try {
      const keys = await this.redis.smembers(listKey);
      if (keys.length > 0) {
        await this.redis.del([...keys, listKey]); // Deleta as chaves e a lista
        this.logger.log(`${keys.length} chaves limpas da lista '${listKey}'.`);
      }
    } catch (error) {
      this.logger.error(`Erro ao deletar chaves da lista '${listKey}'`, error);
    }
  }
}
