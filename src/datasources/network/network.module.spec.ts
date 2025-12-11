import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { ClsModule } from 'nestjs-cls';
import { ConfigurationModule } from '@/config/configuration.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import type { FetchClient } from '@/datasources/network/network.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import { fakeJson } from '@/__tests__/faker';
import type { Server } from 'net';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { hashSha1 } from '@/domain/common/utils/utils';
import { CircuitBreakerModule } from '@/datasources/circuit-breaker/circuit-breaker.module';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitBreakerException } from '@/datasources/circuit-breaker/exceptions/circuit-breaker.exception';
import type { ICircuitConfig } from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';

describe('NetworkModule', () => {
  let app: INestApplication<Server>;
  let fetchClient: FetchClient;
  let defaultTimeout: number;
  let loggingService: ILoggingService;
  let circuitBreakerService: CircuitBreakerService;
  let circuitBreakerConfig: ICircuitConfig | undefined;

  // fetch response is not mocked but we are only concerned with RequestInit options
  const fetchMock = jest.fn();
  jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

  async function initApp(
    cacheInFlightRequests: boolean,
    config?: ICircuitConfig,
  ): Promise<void> {
    circuitBreakerConfig = config;
    const baseConfiguration = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        cacheInFlightRequests,
      },
      circuitBreaker: {
        failureThreshold:
          config?.failureThreshold ??
          baseConfiguration.circuitBreaker.failureThreshold,
        successThreshold:
          config?.successThreshold ??
          baseConfiguration.circuitBreaker.successThreshold,
        timeout: config?.timeout ?? baseConfiguration.circuitBreaker.timeout,
        rollingWindow:
          config?.rollingWindow ??
          baseConfiguration.circuitBreaker.rollingWindow,
        halfOpenMaxRequests:
          config?.halfOpenMaxRequests ??
          baseConfiguration.circuitBreaker.halfOpenMaxRequests,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        NetworkModule,
        // The following imports are required by the Network Module
        // and should be provided in the production app for it to work
        ClsModule.forRoot({ global: true }),
        RequestScopedLoggingModule,
        ConfigurationModule.register(testConfiguration),
        CircuitBreakerModule,
      ],
    }).compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    fetchClient = moduleFixture.get('FetchClient');
    defaultTimeout = configurationService.getOrThrow(
      'httpClient.requestTimeout',
    );
    loggingService = moduleFixture.get<ILoggingService>(LoggingService);
    jest.spyOn(loggingService, 'debug');
    circuitBreakerService = moduleFixture.get<CircuitBreakerService>(
      CircuitBreakerService,
    );

    app = moduleFixture.createNestApplication();
    await app.init();
  }

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('without caching', () => {
    beforeAll(async () => {
      await initApp(false);
    });

    it(`fetch client is created with timeout and is kept alive`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(url, {
        method: 'GET',
        signal: AbortSignal.timeout(defaultTimeout), // timeout is set
        keepalive: true,
      });
    });

    it('throws NetworkRequestError when URL is malformed', async () => {
      // Malformed URL will throw so we need not mock fetch
      await expect(
        fetchClient('malformedUrl', { method: 'GET' }),
      ).rejects.toThrow(new NetworkRequestError(null, expect.any(Error)));

      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it('throws NetworkRequestError when fetch fails', async () => {
      const error = new Error('Fetch failed');
      fetchMock.mockRejectedValue(error);

      const url = faker.internet.url({ appendSlash: false });

      await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow(
        new NetworkRequestError(new URL(url), error),
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws NetworkResponseError when response is not OK', async () => {
      const json = fakeJson();
      const response = {
        ok: false,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });

      await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow(
        new NetworkResponseError(new URL(url), response, json),
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('uses custom timeout when provided as third argument', async () => {
      const url = faker.internet.url({ appendSlash: false });
      const customTimeout = faker.number.int({ min: 1000, max: 10000 });

      await expect(
        fetchClient(url, { method: 'GET' }, customTimeout),
      ).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(url, {
        method: 'GET',
        signal: AbortSignal.timeout(customTimeout),
        keepalive: true,
      });
    });

    it('uses default timeout when timeout is not provided', async () => {
      const url = faker.internet.url({ appendSlash: false });

      await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(url, {
        method: 'GET',
        signal: AbortSignal.timeout(defaultTimeout),
        keepalive: true,
      });
    });
  });

  describe('with caching', () => {
    beforeAll(async () => {
      await initApp(true);
    });

    it('caches GET requests based on URL and options', async () => {
      const json = fakeJson();
      const response = {
        ok: true,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });
      const options = { method: 'GET' };

      void fetchClient(url, options);
      await fetchClient(url, options);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const key = hashSha1(
        JSON.stringify({ url, ...options, circuitBreakerKey: '' }),
      );
      expect(loggingService.debug).toHaveBeenCalledTimes(2);
      expect(loggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'EXTERNAL_REQUEST_CACHE_MISS',
        url,
        key,
      });
      expect(loggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'EXTERNAL_REQUEST_CACHE_HIT',
        url,
        key,
      });
    });

    it('throws NetworkRequestError when fetch fails', async () => {
      const error = new Error('Fetch failed');
      fetchMock.mockRejectedValue(error);

      const url = faker.internet.url({ appendSlash: false });

      await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow(
        new NetworkRequestError(new URL(url), error),
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws NetworkRequestError when fetching POST fails', async () => {
      const error = new Error('Fetch failed');
      fetchMock.mockRejectedValue(error);

      const url = faker.internet.url({ appendSlash: false });

      await expect(fetchClient(url, { method: 'GET' })).rejects.toThrow(
        new NetworkRequestError(new URL(url), error),
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws NetworkResponseError when response is not OK', async () => {
      const json = fakeJson();
      const response = {
        ok: false,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });

      await expect(
        fetchClient(url, {
          method: 'POST',
          body: JSON.stringify({ example: faker.lorem.word() }),
        }),
      ).rejects.toThrow(new NetworkResponseError(new URL(url), response, json));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws NetworkResponseError when a POST request response is not OK', async () => {
      const json = fakeJson();
      const response = {
        ok: false,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });

      await expect(
        fetchClient(url, {
          method: 'POST',
          body: JSON.stringify({ example: faker.lorem.word() }),
        }),
      ).rejects.toThrow(new NetworkResponseError(new URL(url), response, json));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each(['POST', 'DELETE'])(
      'caches %s requests based on URL and options',
      async (method) => {
        const json = fakeJson();
        const response = {
          ok: true,
          json: () => Promise.resolve(json),
        } as Response;
        fetchMock.mockResolvedValue(response);

        const url = faker.internet.url({ appendSlash: false });
        const options = {
          method,
          body: JSON.stringify({ example: 'data' }),
          headers: {
            'Content-Type': 'application/json',
          },
        };

        void fetchClient(url, options);
        await fetchClient(url, options);

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const key = hashSha1(
          JSON.stringify({ url, ...options, circuitBreakerKey: '' }),
        );
        expect(loggingService.debug).toHaveBeenCalledTimes(2);
        expect(loggingService.debug).toHaveBeenNthCalledWith(1, {
          type: 'EXTERNAL_REQUEST_CACHE_MISS',
          url,
          key,
        });
        expect(loggingService.debug).toHaveBeenNthCalledWith(2, {
          type: 'EXTERNAL_REQUEST_CACHE_HIT',
          url,
          key,
        });
      },
    );

    it('clears the cache after successful request', async () => {
      const json = fakeJson();
      const response = {
        ok: true,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });
      const options = { method: 'GET' };

      await fetchClient(url, options);
      await fetchClient(url, options);

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const key = hashSha1(
        JSON.stringify({ url, ...options, circuitBreakerKey: '' }),
      );
      expect(loggingService.debug).toHaveBeenCalledTimes(2);
      expect(loggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'EXTERNAL_REQUEST_CACHE_MISS',
        url,
        key,
      });
      expect(loggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'EXTERNAL_REQUEST_CACHE_MISS',
        url,
        key,
      });
    });

    it('clears the cache after failed request', async () => {
      const json = fakeJson();
      const response = {
        ok: false,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });
      const options = { method: 'GET' };

      try {
        await fetchClient(url, options);
      } catch {
        //
      }
      try {
        await fetchClient(url, options);
      } catch {
        //
      }

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const key = hashSha1(
        JSON.stringify({ url, ...options, circuitBreakerKey: '' }),
      );
      expect(loggingService.debug).toHaveBeenCalledTimes(4);
      expect(loggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'EXTERNAL_REQUEST_CACHE_MISS',
        url,
        key,
      });
      expect(loggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'EXTERNAL_REQUEST_CACHE_ERROR',
        url,
        key,
      });
      expect(loggingService.debug).toHaveBeenNthCalledWith(3, {
        type: 'EXTERNAL_REQUEST_CACHE_MISS',
        url,
        key,
      });
      expect(loggingService.debug).toHaveBeenNthCalledWith(4, {
        type: 'EXTERNAL_REQUEST_CACHE_ERROR',
        url,
        key,
      });
    });
  });

  describe('with circuit breaker enabled', () => {
    beforeAll(async () => {
      await initApp(false, {
        failureThreshold: faker.number.int({ min: 2, max: 5 }),
        successThreshold: faker.number.int({ min: 1, max: 5 }),
        timeout: faker.number.int({ min: 500, max: 2000 }), // Short timeout for faster tests
        rollingWindow: faker.number.int({ min: 60_000, max: 300_000 }),
        halfOpenMaxRequests: faker.number.int({ min: 1, max: 10 }),
      });
    });

    beforeEach(() => {
      // Clear all circuits before each test
      circuitBreakerService.deleteAll();
    });

    it('allows requests when circuit breaker is enabled and circuit is closed', async () => {
      const json = fakeJson();
      const response = {
        ok: true,
        status: 200,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });

      const result = await fetchClient(url, { method: 'GET' }, undefined, true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(200);
      expect(result.data).toEqual(json);
    });

    it('blocks requests when circuit is open', async () => {
      const json = fakeJson();
      const errorResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(errorResponse);

      const url = faker.internet.url({ appendSlash: false });
      const failureThreshold = circuitBreakerConfig?.failureThreshold ?? 2;

      // Trip the circuit
      for (let i = 0; i < failureThreshold; i++) {
        await expect(
          fetchClient(url, { method: 'GET' }, undefined, true),
        ).rejects.toThrow();
      }

      // Clear fetch mock to verify it's not called when circuit is open
      fetchMock.mockClear();

      // Request should be blocked by circuit breaker
      await expect(
        fetchClient(url, { method: 'GET' }, undefined, true),
      ).rejects.toThrow(CircuitBreakerException);

      // Fetch should not be called when circuit is open
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('bypasses circuit breaker when useCircuitBreaker is false', async () => {
      const json = fakeJson();

      const url = faker.internet.url({ appendSlash: false });
      const failureThreshold = circuitBreakerConfig?.failureThreshold ?? 2;

      // Trip the circuit first
      const errorResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve(json),
      } as Response;
      for (let i = 0; i < failureThreshold; i++) {
        fetchMock.mockResolvedValueOnce(errorResponse);
        await expect(
          fetchClient(url, { method: 'GET' }, undefined, true),
        ).rejects.toThrow();
      }

      // Request with useCircuitBreaker: false should bypass circuit breaker
      const successResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValueOnce(successResponse);
      const result = await fetchClient(
        url,
        { method: 'GET' },
        undefined,
        false,
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.status).toBe(200);
    });
  });

  describe('with caching and circuit breaker enabled', () => {
    beforeAll(async () => {
      await initApp(true, {
        failureThreshold: faker.number.int({ min: 2, max: 5 }),
        successThreshold: faker.number.int({ min: 1, max: 5 }),
        timeout: faker.number.int({ min: 500, max: 2000 }), // Short timeout for faster tests
        rollingWindow: faker.number.int({ min: 60_000, max: 300_000 }),
        halfOpenMaxRequests: faker.number.int({ min: 1, max: 10 }),
      });
    });

    beforeEach(() => {
      circuitBreakerService.deleteAll();
    });

    it('uses different cache keys for circuit breaker enabled vs disabled', async () => {
      const json = fakeJson();
      const response = {
        ok: true,
        status: 200,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });
      const options = { method: 'GET' };

      // Request without circuit breaker
      void fetchClient(url, options, undefined, false);
      await fetchClient(url, options, undefined, false);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Request with circuit breaker enabled - should use different cache key
      void fetchClient(url, options, undefined, true);
      await fetchClient(url, options, undefined, true);

      // Should make another fetch call due to different cache key
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const keyWithoutCB = hashSha1(
        JSON.stringify({ url, ...options, circuitBreakerKey: '' }),
      );
      const keyWithCB = hashSha1(
        JSON.stringify({ url, ...options, circuitBreakerKey: '-cb' }),
      );

      expect(keyWithoutCB).not.toBe(keyWithCB);
    });

    it('caches requests with circuit breaker enabled', async () => {
      const json = fakeJson();
      const response = {
        ok: true,
        status: 200,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(response);

      const url = faker.internet.url({ appendSlash: false });
      const options = { method: 'GET' };

      void fetchClient(url, options, undefined, true);
      await fetchClient(url, options, undefined, true);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const key = hashSha1(
        JSON.stringify({ url, ...options, circuitBreakerKey: '-cb' }),
      );
      expect(loggingService.debug).toHaveBeenCalledTimes(2);
      expect(loggingService.debug).toHaveBeenNthCalledWith(1, {
        type: 'EXTERNAL_REQUEST_CACHE_MISS',
        url,
        key,
      });
      expect(loggingService.debug).toHaveBeenNthCalledWith(2, {
        type: 'EXTERNAL_REQUEST_CACHE_HIT',
        url,
        key,
      });
    });

    it('does not cache when circuit breaker blocks request', async () => {
      const json = fakeJson();
      const errorResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve(json),
      } as Response;
      fetchMock.mockResolvedValue(errorResponse);

      const url = faker.internet.url({ appendSlash: false });
      const options = { method: 'GET' };

      // Trip the circuit
      await expect(
        fetchClient(url, options, undefined, true),
      ).rejects.toThrow();
      await expect(
        fetchClient(url, options, undefined, true),
      ).rejects.toThrow();

      fetchMock.mockClear();

      // Circuit is now open - request should be blocked
      await expect(fetchClient(url, options, undefined, true)).rejects.toThrow(
        CircuitBreakerException,
      );

      // Should not cache circuit breaker exceptions
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
