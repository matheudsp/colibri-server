import { ConfigService } from '@nestjs/config';
import { BullModuleOptions } from '@nestjs/bull';

export const bullConfig = (
  configService: ConfigService,
): BullModuleOptions => ({
  redis: {
    host: configService.get<string>('REDIS_HOST'),
    port: configService.get<number>('REDIS_PORT'),
    password: configService.get<string>('REDIS_PASSWORD'),
  },
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});
