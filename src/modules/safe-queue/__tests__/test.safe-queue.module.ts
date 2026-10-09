// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { networkService } from '#/datasources/network/__tests__/test.network.module';
import {
  type INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { ISafeQueueService } from '#/modules/safe-queue/safe-queue.interface';
import { SafeQueueService } from '#/modules/safe-queue/safe-queue.service';

/**
 * Test module that overrides {@link SafeQueueModule} with mocked dependencies.
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
        return mocked(networkService);
      },
    },
    CacheFirstDataSource,
    HttpErrorFactory,
    { provide: ISafeQueueService, useClass: SafeQueueService },
  ],
  exports: [ISafeQueueService],
})
export class TestSafeQueueModule {}
