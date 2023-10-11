import { Global, Module } from '@nestjs/common';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { CacheService } from '@/datasources/cache/cache.service.interface';

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
