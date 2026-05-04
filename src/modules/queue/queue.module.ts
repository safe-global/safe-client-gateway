// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { getQueueAuthHeaders } from '@/datasources/network/auth/queue-auth-headers.helper';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import type { FetchClient } from '@/datasources/network/network.module';
import { FetchClientToken } from '@/datasources/network/network.module';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IQueue } from '@/modules/queue/queue.interface';
import { QueueService } from '@/modules/queue/queue.service';

/**
 * Provides the QueueService backed by a {@link NetworkService} pre-configured
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
      ): FetchNetworkService => {
        const queueHeaders = getQueueAuthHeaders(configService);
        return new FetchNetworkService(client, loggingService, queueHeaders);
      },
      inject: [FetchClientToken, LoggingService, IConfigurationService],
    },
    CacheFirstDataSource,
    HttpErrorFactory,
    { provide: IQueue, useClass: QueueService },
  ],
  exports: [IQueue],
})
export class QueueModule {}
