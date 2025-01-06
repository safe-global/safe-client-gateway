import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { GelatoApi } from '@/datasources/relay-api/gelato-api.service';
import { faker } from '@faker-js/faker';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import type { RedisClientType } from '@/datasources/cache/cache.module';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { rawify } from '@/validation/entities/raw.entity';
import type { ILoggingService } from '@/logging/logging.interface';

const mockNetworkService = jest.mocked({
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = jest.mocked(
  {} as jest.MockedObjectDeep<ILoggingService>,
);

describe('GelatoApi', () => {
  let target: GelatoApi;
  let fakeConfigurationService: FakeConfigurationService;
  let redisClient: RedisClientType;
  let cacheService: ICacheService;
  let baseUri: string;
  let ttlSeconds: number;
  let httpErrorFactory: HttpErrorFactory;
  const expirationTimeInSeconds = faker.number.int();

  beforeEach(async () => {
    jest.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      expirationTimeInSeconds,
    );
    redisClient = await redisClientFactory();
    cacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      fakeConfigurationService,
      '',
    );
    baseUri = faker.internet.url({ appendSlash: false });
    ttlSeconds = faker.number.int();
    fakeConfigurationService.set('relay.baseUri', baseUri);
    fakeConfigurationService.set('relay.ttlSeconds', ttlSeconds);

    target = new GelatoApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
      cacheService,
    );
  });

  afterEach(async () => {
    await redisClient.quit();
  });

  it('should error if baseUri is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      expirationTimeInSeconds,
    );
    const fakeCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      fakeConfigurationService,
      '',
    );
    const httpErrorFactory = new HttpErrorFactory();

    expect(
      () =>
        new GelatoApi(
          mockNetworkService,
          fakeConfigurationService,
          httpErrorFactory,
          fakeCacheService,
        ),
    ).toThrow();
  });

  describe('relay', () => {
    it('should relay the payload', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          taskId,
        }),
      });

      await target.relay({
        chainId,
        to: address,
        data,
        gasLimit: null,
      });

      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/relays/v2/sponsored-call`,
        data: {
          sponsorApiKey: apiKey,
          chainId,
          target: address,
          data,
        },
      });
    });

    it('should add a gas buffer if a gas limit is provided', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const gasLimit = faker.number.bigInt();
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          taskId,
        }),
      });

      await target.relay({
        chainId,
        to: address,
        data,
        gasLimit,
      });

      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/relays/v2/sponsored-call`,
        data: {
          sponsorApiKey: apiKey,
          chainId,
          target: address,
          data,
          gasLimit: (gasLimit + BigInt(150_000)).toString(),
        },
      });
    });

    it('should throw if there is no API key preset', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
          gasLimit: null,
        }),
      ).rejects.toThrow();
    });

    it('should forward error', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const apiKey = faker.string.sample();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/relays/v2/sponsored-call`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
          gasLimit: null,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));
    });
  });

  describe('getRelayCount', () => {
    it('should return the count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1 });
      await cacheService.hSet(
        new CacheDir(`${chainId}_relay_${address}`, ''),
        count.toString(),
        ttlSeconds,
      );

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toBe(count);
    });

    it('should return 0 if the count is not cached', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toBe(0);
    });
  });

  describe('setRelayCount', () => {
    it('should cache the count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1 });

      await target.setRelayCount({
        chainId,
        address,
        count,
      });

      const result = await cacheService.hGet(
        new CacheDir(`${chainId}_relay_${address}`, ''),
      );
      expect(result).toBe(count.toString());
    });
  });
});
