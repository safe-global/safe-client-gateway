// SPDX-License-Identifier: FSL-1.1-MIT
import { Global, Module } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CircuitBreakerService } from '#/datasources/circuit-breaker/circuit-breaker.service';
import {
  type FetchClient,
  FetchClientToken,
} from '#/datasources/network/entities/fetch-client.entity';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '#/datasources/network/entities/network.error.entity';
import type { NetworkRequest } from '#/datasources/network/entities/network.request.entity';
import type { NetworkResponse } from '#/datasources/network/entities/network.response.entity';
import { FetchNetworkService } from '#/datasources/network/fetch.network.service';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { LogType } from '#/domain/common/entities/log-type.entity';
import { hashSha1 } from '#/domain/common/utils/utils';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { withHttpClientSpan } from '#/tracing/http-client-span';
import type { Raw } from '#/validation/entities/raw.entity';

const cache: Record<string, Promise<NetworkResponse<unknown>>> = {};

/**
 * Use this factory to create a {@link FetchClient} instance
 * that can be used to make HTTP requests.
 */
function fetchClientFactory(
  configurationService: IConfigurationService,
  circuitBreakerService: CircuitBreakerService,
  loggingService: ILoggingService,
): FetchClient {
  const cacheInFlightRequests = configurationService.getOrThrow<boolean>(
    'features.cacheInFlightRequests',
  );
  const defaultTimeout = configurationService.getOrThrow<number>(
    'httpClient.requestTimeout',
  );

  const baseRequest = createRequestFunction(defaultTimeout);
  const circuitBreakerRequest = createCircuitBreakerRequestFunction(
    baseRequest,
    circuitBreakerService,
  );

  if (!cacheInFlightRequests) {
    return circuitBreakerRequest;
  }

  return createCachedRequestFunction(circuitBreakerRequest, loggingService);
}

function createRequestFunction(defaultTimeout: number) {
  return async <T>(
    url: string,
    options: RequestInit,
    customTimeout?: number,
    responseType: NetworkRequest['responseType'] = 'json',
  ): Promise<NetworkResponse<T>> => {
    let urlObject: URL | null = null;
    let response: Response | null = null;

    try {
      const requestUrl = new URL(url);
      urlObject = requestUrl;
      const timeout = customTimeout ?? defaultTimeout;

      response = await withHttpClientSpan(
        {
          url: requestUrl,
          init: {
            ...options,
            signal: AbortSignal.timeout(timeout),
            keepalive: true,
          },
        },
        (init) => fetch(url, init),
      );
    } catch (error) {
      throw new NetworkRequestError(urlObject, error);
    }

    // We validate data so don't need worry about casting `null` response
    const data = (
      responseType === 'text'
        ? await response.text().catch(() => null)
        : await response.json().catch(() => null)
    ) as Raw<T>;

    if (!response.ok) {
      throw new NetworkResponseError(urlObject, response, data);
    }

    return {
      status: response.status,
      data,
    };
  };
}

/**
 * Wraps a request function with circuit breaker logic
 *
 * This function intercepts requests and applies circuit breaker protection:
 * - Checks if the circuit is open before allowing the request
 * - Records successes and failures based on response status
 * - Must be explicitly enabled per request via the circuitBreaker parameter
 *
 * @param request - The base request function to wrap
 * @param circuitBreakerService - Service managing circuit breaker state
 *
 * @returns Wrapped request function with circuit breaker logic
 */
function createCircuitBreakerRequestFunction(
  request: <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
    responseType?: NetworkRequest['responseType'],
  ) => Promise<NetworkResponse<T>>,
  circuitBreakerService: CircuitBreakerService,
) {
  return async <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
    circuitBreaker?: NetworkRequest['circuitBreaker'],
    responseType?: NetworkRequest['responseType'],
  ): Promise<NetworkResponse<T>> => {
    if (!circuitBreaker?.key) {
      return request(url, options, timeout, responseType);
    }

    circuitBreakerService.canProceedOrFail(circuitBreaker.key);

    try {
      const response = await request(url, options, timeout, responseType);
      circuitBreakerService.recordSuccess(circuitBreaker.key);
      return response;
    } catch (error) {
      const isServerError =
        error instanceof NetworkResponseError && error.response.status >= 500;
      const isNetworkError = error instanceof NetworkRequestError;
      if (isServerError || isNetworkError) {
        circuitBreakerService.recordFailure(circuitBreaker.key);
      } else {
        circuitBreakerService.recordSuccess(circuitBreaker.key);
      }

      throw error;
    }
  };
}

function createCachedRequestFunction(
  request: <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
    circuitBreaker?: NetworkRequest['circuitBreaker'],
    responseType?: NetworkRequest['responseType'],
  ) => Promise<NetworkResponse<T>>,
  loggingService: ILoggingService,
) {
  return <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
    circuitBreaker?: NetworkRequest['circuitBreaker'],
    responseType?: NetworkRequest['responseType'],
  ): Promise<NetworkResponse<T>> => {
    const key = getCacheKey(
      url,
      options,
      timeout,
      circuitBreaker,
      responseType,
    );
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

      cache[key] = request(url, options, timeout, circuitBreaker, responseType)
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

    return cache[key] as Promise<NetworkResponse<T>>;
  };
}

function getCacheKey(
  url: string,
  requestInit?: RequestInit,
  timeout?: number,
  circuitBreaker?: NetworkRequest['circuitBreaker'],
  responseType?: NetworkRequest['responseType'],
): string {
  if (
    !requestInit &&
    timeout === undefined &&
    !circuitBreaker &&
    !responseType
  ) {
    return url;
  }

  // JSON.stringify does not produce a stable key but initially
  // use a naive implementation for testing the implementation
  // TODO: Revisit this and use a more stable key
  const circuitBreakerKey = circuitBreaker?.key || '';
  const key = JSON.stringify({
    url,
    responseType,
    ...requestInit,
    timeout,
    circuitBreakerKey,
  });
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
      provide: FetchClientToken,
      useFactory: fetchClientFactory,
      inject: [IConfigurationService, CircuitBreakerService, LoggingService],
    },
    {
      provide: NetworkService,
      useFactory: (
        client: FetchClient,
        loggingService: ILoggingService,
      ): FetchNetworkService => {
        return new FetchNetworkService(client, loggingService);
      },
      inject: [FetchClientToken, LoggingService],
    },
  ],
  exports: [NetworkService, FetchClientToken],
})
export class NetworkModule {}
