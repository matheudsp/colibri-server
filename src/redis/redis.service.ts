import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly defaultTtl: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = this.configService.get<number>(
      'REDIS_DEFAULT_TTL',
      60 * 60 * 24,
    ); // 24h
  }

  // Métodos básicos de chave-valor
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(
    key: string,
    value: string,
    ttl: number = this.defaultTtl,
  ): Promise<'OK'> {
    return ttl > 0
      ? this.redis.set(key, value, 'EX', ttl)
      : this.redis.set(key, value);
  }

  async delete(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  // Métodos para hash
  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  // Métodos para listas
  async lPush(key: string, ...values: string[]): Promise<number> {
    return this.redis.lpush(key, ...values);
  }

  async rPush(key: string, ...values: string[]): Promise<number> {
    return this.redis.rpush(key, ...values);
  }

  async lPop(key: string): Promise<string | null> {
    return this.redis.lpop(key);
  }

  async rPop(key: string): Promise<string | null> {
    return this.redis.rpop(key);
  }

  // Métodos para conjuntos
  async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  async sMembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  // Métodos para pub/sub
  async publish(channel: string, message: string): Promise<number> {
    return this.redis.publish(channel, message);
  }

  // Métodos utilitários
  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async flushAll(): Promise<'OK'> {
    return this.redis.flushall();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Redis health check failed', error.stack);
      } else {
        this.logger.error('Redis health check failed with an unknown error');
      }
      return false;
    }
  }

  // Métodos avançados com transações
  async multiExec(
    callback: (multi: ReturnType<Redis['multi']>) => void,
  ): Promise<[Error | null, any][]> {
    const multi = this.redis.multi();
    callback(multi);
    const result = await multi.exec();
    return result || [];
  }
}
