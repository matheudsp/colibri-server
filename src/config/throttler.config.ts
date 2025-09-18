import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig = (
  configService: ConfigService,
): ThrottlerModuleOptions => [
  {
    name: 'default',
    ttl: configService.get<number>('THROTTLE_TTL_DEFAULT', 60) * 1000,
    limit: configService.get<number>('THROTTLE_LIMIT_DEFAULT', 100),
  },
  {
    name: 'strict',
    ttl: configService.get<number>('THROTTLE_TTL_STRICT', 1) * 1000,
    limit: configService.get<number>('THROTTLE_LIMIT_STRICT', 5),
  },
];
