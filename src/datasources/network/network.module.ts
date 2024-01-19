import { Global, Module } from '@nestjs/common';
import {
  FETCH_CLIENT,
  fetchClientFactory,
} from '@/datasources/network/fetch.client';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import { NetworkService } from '@/datasources/network/network.service.interface';

/**
 * A {@link Global} Module which provides HTTP support via {@link NetworkService}
 * Feature Modules don't need to import this module directly in order to inject
 * the {@link NetworkService}.
 *
 * This module should be included in the "root" application module
 */
@Global()
@Module({
  providers: [
    {
      provide: FETCH_CLIENT,
      useFactory: fetchClientFactory,
      inject: [IConfigurationService],
    },
    { provide: NetworkService, useClass: FetchNetworkService },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
