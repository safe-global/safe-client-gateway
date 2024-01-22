import { Global, Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
) => Promise<NetworkResponse<T>>;

/**
 * Use this factory to create a {@link FetchClient} instance
 * that can be used to make HTTP requests.
 */
function fetchClientFactory(
  configurationService: IConfigurationService,
): FetchClient {
  const requestTimeout = configurationService.getOrThrow<number>(
    'httpClient.requestTimeout',
  );

  // TODO: Adjust structure of NetworkRequestError/NetworkResponseError and throw here
  return async <T>(
    url: string,
    options: RequestInit,
  ): Promise<NetworkResponse<T>> => {
    let response: Response | null = null;
    let request: URL | null = null;

    try {
      request = new URL(url);
    } catch (error) {
      // NetworkRequestError
      throw {
        request: null,
        data: error,
      };
    }

    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(requestTimeout),
        keepalive: true,
      });
    } catch (error) {
      // NetworkRequestError
      throw {
        request,
        data: error,
      };
    }

    // We validate data so don't need worry about casting `null` response
    const data = (await response.json().catch(() => null)) as T;

    if (!response.ok) {
      // NetworkResponseError
      throw {
        request,
        response,
        data,
      };
    }

    return {
      status: response.status,
      data,
    };
  };
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
      provide: 'FetchClient',
      useFactory: fetchClientFactory,
      inject: [IConfigurationService],
    },
    { provide: NetworkService, useClass: FetchNetworkService },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
