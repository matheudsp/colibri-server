import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';

export const cacheConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  ttl: configService.get<number>('CACHE_TTL', 5),
  max: configService.get<number>('CACHE_MAX_ITEMS', 100),
  store: configService.get<string>('CACHE_STORE', 'memory'),
  isGlobal: true,
});
