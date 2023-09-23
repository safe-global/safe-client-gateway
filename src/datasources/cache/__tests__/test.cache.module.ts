import { Global, Module } from '@nestjs/common';
import { CacheService } from '../cache.service.interface';
import { FakeCacheService } from './fake.cache.service';
import { CacheReadiness } from '@/domain/interfaces/cache-readiness.interface';

/**
 * The {@link TestCacheModule} should be used whenever you want to
 * override the values provided by the {@link CacheService}
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestCacheModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real Cache Module with a fake one – {@link FakeCacheService}
 */
@Global()
@Module({
  providers: [
    { provide: CacheService, useClass: FakeCacheService },
    {
      provide: CacheReadiness,
      useExisting: CacheService,
    },
  ],
  exports: [CacheService, CacheReadiness],
})
export class TestCacheModule {}
