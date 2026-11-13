// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { getSafeQueueAuthHeaders } from '#/datasources/network/auth/queue-auth-headers.helper';
import type { FetchNetworkService } from '#/datasources/network/fetch.network.service';
import type { FetchClient } from '#/datasources/network/network.module';
import { FetchClientToken } from '#/datasources/network/network.module';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { createSafeInternalNetworkService } from '#/datasources/network/safe-internal.network.module';
import { ILoggingService, LoggingService } from '#/logging/logging.interface';
import { ISafeQueueService } from '#/modules/safe-queue/safe-queue.interface';
import { SafeQueueService } from '#/modules/safe-queue/safe-queue.service';

/**
 * Provides the SafeQueueService backed by a {@link NetworkService} for Safe services
 * (see {@link createSafeInternalNetworkService}), pre-configured
 * with Queue Service authentication headers and a local {@link CacheFirstDataSource}
 * that uses the same authenticated NetworkService.
 */
@Module({
  providers: [
    {
      provide: NetworkService,
      useFactory: (
        client: FetchClient,
        loggingService: ILoggingService,
        configService: IConfigurationService,
        cls: ClsService,
      ): FetchNetworkService => {
        return createSafeInternalNetworkService({
          client,
          loggingService,
          cls,
          defaultHeaders: getSafeQueueAuthHeaders(configService),
        });
      },
      inject: [
        FetchClientToken,
        LoggingService,
        IConfigurationService,
        ClsService,
      ],
    },
    CacheFirstDataSource,
    HttpErrorFactory,
    { provide: ISafeQueueService, useClass: SafeQueueService },
  ],
  exports: [ISafeQueueService],
})
export class SafeQueueModule {}
