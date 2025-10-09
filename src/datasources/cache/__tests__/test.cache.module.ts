import { Global, Module } from '@nestjs/common';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { ResponseCacheService } from '@/datasources/cache/response-cache.service';

const responseCacheServiceStub: Pick<
  ResponseCacheService,
  'trackTtl' | 'getTtl' | 'hasTtlTrackingFailed'
> = {
  trackTtl: (): void => undefined,
  getTtl: (): number | undefined => undefined,
  hasTtlTrackingFailed: (): boolean => false,
};

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
    {
      provide: ResponseCacheService,
      useValue: responseCacheServiceStub,
    },
  ],
  exports: [CacheService, CacheReadiness, ResponseCacheService],
})
export class TestCacheModule {}
