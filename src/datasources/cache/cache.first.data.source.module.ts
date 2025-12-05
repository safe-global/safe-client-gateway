import { Module } from '@nestjs/common';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  INetworkService,
  TxNetworkService,
} from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

export const TxCacheFirstDataSource = Symbol('TxCacheFirstDataSource');

@Module({
  providers: [
    CacheFirstDataSource,
    HttpErrorFactory,
    {
      provide: TxCacheFirstDataSource,
      // Tx-flavored CacheFirstDataSource wired to the TxNetworkService so Tx Service consumers get the auth header behavior.
      useFactory: (
        cacheService: ICacheService,
        networkService: INetworkService,
        loggingService: ILoggingService,
        configurationService: IConfigurationService,
      ): CacheFirstDataSource =>
        new CacheFirstDataSource(
          cacheService,
          networkService,
          loggingService,
          configurationService,
        ),
      inject: [
        CacheService,
        TxNetworkService,
        LoggingService,
        IConfigurationService,
      ],
    },
  ],
  exports: [CacheFirstDataSource, TxCacheFirstDataSource],
})
export class CacheFirstDataSourceModule {}
