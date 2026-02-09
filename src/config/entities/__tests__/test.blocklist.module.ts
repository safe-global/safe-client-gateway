import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { Global, Module } from '@nestjs/common';
import type { Address } from 'viem';

/**
 * Uses a real class instead of a mock object (like TestNetworkModule does) due to:
 * - The default behavior (returning empty array) needs to survive jest.resetAllMocks()
 * - Tests only need jest.spyOn() when they want to override the default behavior
 */
class TestBlocklistService implements IBlocklistService {
  getBlocklist(): Array<Address> {
    // Return empty blocklist by default in tests
    return [];
  }

  clearCache(): void {
    // No-op in tests
  }
}

/**
 * The {@link TestBlocklistModule} should be used whenever a mocked blocklist service
 * should be used.
 *
 * Example:
 * Test.createTestingModule({ imports: [ModuleA, TestBlocklistModule]}).compile();
 *
 * This will create a TestModule which uses the implementation of ModuleA but
 * overrides the real blocklist service with a mocked one
 */
@Global()
@Module({
  providers: [
    {
      provide: IBlocklistService,
      useClass: TestBlocklistService,
    },
  ],
  exports: [IBlocklistService],
})
export class TestBlocklistModule {}
