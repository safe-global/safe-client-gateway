import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { Global, Module } from '@nestjs/common';
import type { Address } from 'viem';

class TestBlocklistService implements IBlocklistService {
  getBlocklist(): Array<Address> {
    // Return empty blocklist by default in tests
    return [];
  }

  clearCache(): void {
    // No-op in tests
  }
}

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
