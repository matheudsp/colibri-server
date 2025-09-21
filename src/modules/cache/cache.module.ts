import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisModule } from 'src/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}
