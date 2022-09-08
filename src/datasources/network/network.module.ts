import { Global, Module } from '@nestjs/common';
import { AxiosNetworkService } from './axios.network.service';
import { NetworkService } from './network.service.interface';
import axios, { Axios } from 'axios';

/**
 * Use this factory to add any default parameter to the
 * {@link Axios} instance
 */
function axiosFactory(): Axios {
  return axios.create();
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
    { provide: 'AxiosClient', useFactory: axiosFactory },
    { provide: NetworkService, useClass: AxiosNetworkService },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
