// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { networkService } from '@/datasources/network/__tests__/test.network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IQueue } from '@/modules/queue/queue.interface';
import { QueueService } from '@/modules/queue/queue.service';

/**
 * Test module that overrides {@link QueueModule} with mocked dependencies.
 *
 * Key points:
 * - Reuses the same NetworkService mock instance from {@link TestNetworkModule}
 * - Provides real CacheFirstDataSource & HttpErrorFactory (with mocked NetworkService injected)
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
    HttpErrorFactory,
    { provide: IQueue, useClass: QueueService },
  ],
  exports: [IQueue],
})
export class TestQueueModule {}
