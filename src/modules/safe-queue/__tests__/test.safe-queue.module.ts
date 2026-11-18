// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { networkService } from '#/datasources/network/__tests__/test.network.module';
import {
  INetworkService,
  NetworkService,
} from '#/datasources/network/network.service.interface';
import { SafeQueueChangesCacheService } from '#/modules/safe-queue/datasources/safe-queue-changes-cache.service';
import { ISafeQueueChangesCacheService } from '#/modules/safe-queue/datasources/safe-queue-changes-cache.service.interface';
import { SafeQueueChangesRepository } from '#/modules/safe-queue/domain/safe-queue-changes.repository';
import { ISafeQueueChangesRepository } from '#/modules/safe-queue/domain/safe-queue-changes.repository.interface';
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
        return vi.mocked(networkService);
      },
    },
    CacheFirstDataSource,
    HttpErrorFactory,
    { provide: ISafeQueueService, useClass: SafeQueueService },
    {
      provide: ISafeQueueChangesCacheService,
      useClass: SafeQueueChangesCacheService,
    },
    {
      provide: ISafeQueueChangesRepository,
      useClass: SafeQueueChangesRepository,
    },
  ],
  exports: [ISafeQueueService, ISafeQueueChangesRepository],
})
export class TestSafeQueueModule {}
