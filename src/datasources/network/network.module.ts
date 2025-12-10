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
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitBreakerException } from '@/datasources/circuit-breaker/exceptions/circuit-breaker.exception';

export type FetchClient = <T>(
  url: string,
  options: RequestInit,
  timeout?: number,
  useCircuitBreaker?: boolean,
) => Promise<NetworkResponse<T>>;

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
  const circuitBreakerEnabledByDefault =
    configurationService.getOrThrow<boolean>('circuitBreaker.enabled');

  const baseRequest = createRequestFunction(defaultTimeout);
  const circuitBreakerRequest = createCircuitBreakerRequestFunction(
    baseRequest,
    circuitBreakerService,
    circuitBreakerEnabledByDefault,
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
  ): Promise<NetworkResponse<T>> => {
    let urlObject: URL | null = null;
    let response: Response | null = null;

    try {
      urlObject = new URL(url);
      const timeout = customTimeout ?? defaultTimeout;

      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeout),
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

/**
 * Wraps a request function with circuit breaker logic
 *
 * This function intercepts requests and applies circuit breaker protection:
 * - Checks if the circuit is open before allowing the request
 * - Records successes and failures based on response status
 * - Can be enabled/disabled per request via the useCircuitBreaker parameter
 *
 * @param request - The base request function to wrap
 * @param circuitBreakerService - Service managing circuit breaker state
 * @param enabledByDefault - Whether circuit breaker is enabled by default
 * @returns Wrapped request function with circuit breaker logic
 */
function createCircuitBreakerRequestFunction(
  request: <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
  ) => Promise<NetworkResponse<T>>,
  circuitBreakerService: CircuitBreakerService,
  enabledByDefault: boolean,
) {
  return async <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
    useCircuitBreaker?: boolean,
  ): Promise<NetworkResponse<T>> => {
    const shouldUseCircuitBreaker = useCircuitBreaker ?? enabledByDefault;

    if (!shouldUseCircuitBreaker) {
      return request(url, options, timeout);
    }

    circuitBreakerService.canProceedOrFail(url);

    try {
      const response = await request(url, options, timeout);
      circuitBreakerService.recordSuccess(url);

      return response;
    } catch (error) {
      if (
        (error instanceof NetworkResponseError &&
          error.response.status >= 500) ||
        error instanceof CircuitBreakerException
      ) {
        const circuit = circuitBreakerService.getOrRegisterCircuit(url);
        circuitBreakerService.recordFailure(circuit);
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
    useCircuitBreaker?: boolean,
  ) => Promise<NetworkResponse<T>>,
  loggingService: ILoggingService,
) {
  return async <T>(
    url: string,
    options: RequestInit,
    timeout?: number,
    useCircuitBreaker?: boolean,
  ): Promise<NetworkResponse<T>> => {
    const key = getCacheKey(url, options, timeout);
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

      cache[key] = request(url, options, timeout, useCircuitBreaker)
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

function getCacheKey(
  url: string,
  requestInit?: RequestInit,
  timeout?: number,
  useCircuitBreaker?: boolean,
): string {
  if (
    !requestInit &&
    timeout === undefined &&
    useCircuitBreaker === undefined
  ) {
    return url;
  }

  // JSON.stringify does not produce a stable key but initially
  // use a naive implementation for testing the implementation
  // TODO: Revisit this and use a more stable key
  const key = JSON.stringify({
    url,
    ...requestInit,
    timeout,
    useCircuitBreaker,
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
      provide: 'FetchClient',
      useFactory: fetchClientFactory,
      inject: [IConfigurationService, CircuitBreakerService, LoggingService],
    },
    { provide: NetworkService, useClass: FetchNetworkService },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
