import { Global, Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import { NetworkService } from '@/datasources/network/network.service.interface';

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
) => Promise<{ data: T }>;

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

  return async <T>(url: string, options: RequestInit): Promise<{ data: T }> => {
    // If general error - NetworkOtherError
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(requestTimeout),
      keepalive: true,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (!data) {
        // Response error (no response) - NetworkRequestError
        throw {
          request: new URL(url),
        };
      } else {
        // Response error - NetworkResponseError
        throw {
          response: {
            ...response,
            data,
          },
        };
      }
    }

    return {
      data: data as T,
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
