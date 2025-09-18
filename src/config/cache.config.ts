import { ConfigService } from '@nestjs/config';
import type { CacheModuleOptions } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

export const cacheConfig = async (
  configService: ConfigService,
): Promise<CacheModuleOptions> => ({
  store: await redisStore({
    url: configService.get<string>('REDIS_URL'),
    ttl: configService.get<number>('CACHE_TTL', 5) * 1000, // TTL em milissegundos
    keyPrefix: configService.get<string>('REDIS_PREFIX', 'colibri:'), // Garante o mesmo prefixo
  }),
  isGlobal: true,
});
