import { Global, Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { hashSha1 } from '@/domain/common/utils/utils';

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
) => Promise<NetworkResponse<T>>;

const cache: Record<string, Promise<NetworkResponse<unknown>>> = {};

/**
 * Use this factory to create a {@link FetchClient} instance
 * that can be used to make HTTP requests.
 */
function fetchClientFactory(
  configurationService: IConfigurationService,
  loggingService: ILoggingService,
): FetchClient {
  const cacheInFlightRequests = configurationService.getOrThrow<boolean>(
    'features.cacheInFlightRequests',
  );
  const requestTimeout = configurationService.getOrThrow<number>(
    'httpClient.requestTimeout',
  );

  const request = createRequestFunction(requestTimeout);

  if (!cacheInFlightRequests) {
    return request;
  }

  return createCachedRequestFunction(request, loggingService);
}

function createRequestFunction(requestTimeout: number) {
  return async <T>(
    url: string,
    options: RequestInit,
  ): Promise<NetworkResponse<T>> => {
    let urlObject: URL | null = null;
    let response: Response | null = null;

    try {
      urlObject = new URL(url);
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(requestTimeout),
        keepalive: true,
      });
    } catch (error) {
      throw new NetworkRequestError(urlObject, error);
    }

    // We validate data so don't need worry about casting `null` response
    const data = (await response.json().catch(() => null)) as Raw<T>;

    if (!response.ok) {
      throw new NetworkResponseError(urlObject, response, data);
    }

    return {
      status: response.status,
      data,
    };
  };
}

function createCachedRequestFunction(
  request: <T>(
    url: string,
    options: RequestInit,
  ) => Promise<NetworkResponse<T>>,
  loggingService: ILoggingService,
) {
  return async <T>(
    url: string,
    options: RequestInit,
  ): Promise<NetworkResponse<T>> => {
    const key = getCacheKey(url, options);
    if (key in cache) {
      loggingService.debug({
        type: LogType.ExternalRequestCacheHit,
        url,
        key,
      });
    } else {
      loggingService.debug({
        type: LogType.ExternalRequestCacheMiss,
        url,
        key,
      });

      cache[key] = request(url, options)
        .catch((err) => {
          loggingService.debug({
            type: LogType.ExternalRequestCacheError,
            url,
            key,
          });
          throw err;
        })
        .finally(() => {
          delete cache[key];
        });
    }

    return cache[key];
  };
}

function getCacheKey(url: string, requestInit?: RequestInit): string {
  if (!requestInit) {
    return url;
  }

  // JSON.stringify does not produce a stable key but initially
  // use a naive implementation for testing the implementation
  // TODO: Revisit this and use a more stable key
  const key = JSON.stringify({ url, ...requestInit });
  return hashSha1(key);
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
      inject: [IConfigurationService, LoggingService],
    },
    { provide: NetworkService, useClass: FetchNetworkService },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
