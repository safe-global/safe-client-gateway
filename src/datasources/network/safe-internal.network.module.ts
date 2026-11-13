// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CacheFirstDataSource } from '#/datasources/cache/cache.first.data.source';
import { FetchNetworkService } from '#/datasources/network/fetch.network.service';
import {
  type FetchClient,
  FetchClientToken,
} from '#/datasources/network/network.module';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { getSafeRequestIdHeaders } from '#/datasources/network/safe-request-id-header.helper';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';

/**
 * Creates a {@link FetchNetworkService} for Safe services, which sends the
 * current request ID as `x-safe-req-id` with every request.
 */
export function createSafeInternalNetworkService(args: {
  client: FetchClient;
  loggingService: ILoggingService;
  cls: ClsService;
  defaultHeaders?: Record<string, string>;
}): FetchNetworkService {
  return new FetchNetworkService(args.client, args.loggingService, {
    defaultHeaders: args.defaultHeaders,
    contextHeaders: () => getSafeRequestIdHeaders(args.cls),
  });
}

/**
 * Provides a {@link NetworkService}, and a {@link CacheFirstDataSource} using
 * it, for Safe services.
 *
 * It overrides the global NetworkService for every provider of the importing
 * module, so only import it from a module whose providers all call Safe
 * services. Never import it alongside CacheFirstDataSourceModule, nor
 * re-export it.
 */
@Module({
  providers: [
    {
      provide: NetworkService,
      useFactory: (
        client: FetchClient,
        loggingService: ILoggingService,
        cls: ClsService,
      ): FetchNetworkService => {
        return createSafeInternalNetworkService({
          client,
          loggingService,
          cls,
        });
      },
      inject: [FetchClientToken, LoggingService, ClsService],
    },
    CacheFirstDataSource,
  ],
  exports: [NetworkService, CacheFirstDataSource],
})
export class SafeInternalNetworkModule {}
