import { Global, Module } from '@nestjs/common';
import { CacheService } from '../cache.service.interface';
import { FakeCacheService } from './fake.cache.service';

/**
 * {@link fakeCacheService} should be used in a test setup.
 *
 * It provides the ability to change the cache state by adding/removing keys
 * associated with the cache
 *
 * {@link fakeCacheService} is available only when a module imports
 * {@link TestCacheModule}
 */
export const fakeCacheService = new FakeCacheService();

/**
 * The {@link TestCacheModule} should be used whenever you want to
 * override the values provided by the {@link CacheService}
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestCacheModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real Cache Module with a fake one – {@link fakeCacheService}
 */
@Global()
@Module({
  providers: [{ provide: CacheService, useValue: fakeCacheService }],
  exports: [CacheService],
})
export class TestCacheModule {}
