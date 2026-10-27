// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { CacheFirstDataSourceModule } from '#/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { getTxAuthHeaders } from '#/datasources/network/auth/tx-auth-headers.helper';
import type { FetchNetworkService } from '#/datasources/network/fetch.network.service';
import type { FetchClient } from '#/datasources/network/network.module';
import { FetchClientToken } from '#/datasources/network/network.module';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { createSafeInternalNetworkService } from '#/datasources/network/safe-internal.network.module';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';

/**
 * Provides a NetworkService for the Transaction Service (see
 * {@link createSafeInternalNetworkService}) and CacheFirstDataSource that uses
 * this NetworkService. It also sends TX Service authentication headers in local
 * development mode (when running with local instance of Safe{Wallet}).
 */
@Module({
  imports: [CacheFirstDataSourceModule],
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
          defaultHeaders: getTxAuthHeaders(configService),
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
  ],
  exports: [NetworkService, CacheFirstDataSource, HttpErrorFactory],
})
export class TxAuthNetworkModule {}
