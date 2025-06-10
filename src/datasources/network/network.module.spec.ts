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

describe('NetworkModule', () => {
  let app: INestApplication<Server>;
  let fetchClient: FetchClient;
  let httpClientTimeout: number;
  let loggingService: ILoggingService;

  // fetch response is not mocked but we are only concerned with RequestInit options
  const fetchMock = jest.fn();
  jest.spyOn(global, 'fetch').mockImplementation(fetchMock);

  async function initApp(cacheInFlightRequests: boolean): Promise<void> {
    const baseConfiguration = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        cacheInFlightRequests,
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
      ],
    }).compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    fetchClient = moduleFixture.get('FetchClient');
    httpClientTimeout = configurationService.getOrThrow(
      'httpClient.requestTimeout',
    );
    loggingService = moduleFixture.get<ILoggingService>(LoggingService);
    jest.spyOn(loggingService, 'debug');

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
        signal: AbortSignal.timeout(httpClientTimeout), // timeout is set
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

      const key = hashSha1(JSON.stringify({ url, ...options }));
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

        const key = hashSha1(JSON.stringify({ url, ...options }));
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

      const key = hashSha1(JSON.stringify({ url, ...options }));
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

      const key = hashSha1(JSON.stringify({ url, ...options }));
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
});
