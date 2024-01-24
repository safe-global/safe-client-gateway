import { Global, Module } from '@nestjs/common';
import axios, { Axios } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AxiosNetworkService } from '@/datasources/network/axios.network.service';
import { NetworkService } from '@/datasources/network/network.service.interface';

/**
 * Use this factory to add any default parameter to the
 * {@link Axios} instance
 */
function axiosFactory(configurationService: IConfigurationService): Axios {
  const requestTimeout = configurationService.getOrThrow<number>(
    'httpClient.requestTimeout',
  );
  return axios.create({
    timeout: requestTimeout,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
  });
}

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
      provide: 'AxiosClient',
      useFactory: axiosFactory,
      inject: [IConfigurationService],
    },
    { provide: NetworkService, useClass: AxiosNetworkService },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
