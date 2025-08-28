import { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';

export const redisConfig = (
  configService: ConfigService,
): RedisModuleOptions => ({
  type: 'single',
  url: configService.get<string>('REDIS_URL'),
  options: {
    host: configService.get<string>('REDIS_HOST'),
    port: configService.get<number>('REDIS_PORT'),
    password: configService.get<string>('REDIS_PASSWORD'),
    keyPrefix: configService.get<string>('REDIS_PREFIX', 'colibri:'),
    tls: configService.get<boolean>('REDIS_TLS') ? {} : undefined,
    // Aumenta o tempo máximo de espera pela resposta do Redis
    commandTimeout: 5000,
    // Garante que a conexão seja mantida ativa
    keepAlive: 1000,
    retryStrategy: (times: number) => {
      // Aumenta o delay máximo para 5 segundos para dar tempo ao Redis de se recuperar
      const delay = Math.min(times * 100, 5000);
      console.log(
        `Redis: Tentando reconectar (tentativa ${times}), aguardando ${delay}ms`,
      );
      return delay;
    },
    // Limita o número de tentativas de reconexão a um valor razoável
    maxRetriesPerRequest: 5,
    enableOfflineQueue: true,
  },
});
