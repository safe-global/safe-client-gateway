// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { networkService } from '#/datasources/network/__tests__/test.network.module';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';

/**
 * Test module that overrides {@link SafeInternalNetworkModule}, reusing the
 * NetworkService mock of {@link TestNetworkModule}.
 */
@Module({
  providers: [
    {
      provide: NetworkService,
      useFactory: (): MockedObject<INetworkService> => {
        return vi.mocked(networkService);
      },
    },
    CacheFirstDataSource,
  ],
  exports: [NetworkService, CacheFirstDataSource],
})
export class TestSafeInternalNetworkModule {}
