import { Global, Module } from '@nestjs/common';
import { CacheService } from '../cache.service.interface';
import { FakeCacheService } from './fake.cache.service';

@Global()
@Module({
  providers: [{ provide: CacheService, useClass: FakeCacheService }],
  exports: [CacheService],
})
export class TestCacheModule {}
