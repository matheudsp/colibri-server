import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { redisConfig } from '../config/redis.config';

@Module({
  imports: [
    NestRedisModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: redisConfig,
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
