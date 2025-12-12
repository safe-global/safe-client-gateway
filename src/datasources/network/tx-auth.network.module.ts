import { Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getTxAuthHeaders } from '@/datasources/network/auth/tx-auth-headers.helper';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import { NetworkService } from '@/datasources/network/network.service.interface';
import type { FetchClient } from '@/datasources/network/network.module';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';

/**
 * Provides a NetworkService instance configured with TX Service authentication headers
 * and CacheFirstDataSource that uses this NetworkService.
 * This module should be imported by modules that need to communicate with the Transaction Service
 * in local development mode (when running with local instance of Safe{Wallet}).
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
      ): FetchNetworkService => {
        const txHeaders = getTxAuthHeaders(configService);
        return new FetchNetworkService(client, loggingService, txHeaders);
      },
      inject: ['FetchClient', LoggingService, IConfigurationService],
    },
    CacheFirstDataSource,
    HttpErrorFactory,
  ],
  exports: [NetworkService, CacheFirstDataSource, HttpErrorFactory],
})
export class TxAuthNetworkModule {}
