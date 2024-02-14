import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { GelatoApi } from '@/datasources/relay-api/gelato-api.service';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { GelatoRelay } from '@gelatonetwork/relay-sdk';
import { Hex } from 'viem';

const mockGelatoClient = jest.mocked({
  sponsoredCall: jest.fn(),
} as jest.MockedObjectDeep<InstanceType<typeof GelatoRelay>>);

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('GelatoApi', () => {
  let target: GelatoApi;
  let fakeConfigurationService: FakeConfigurationService;
  let fakeCacheService: FakeCacheService;

  beforeEach(async () => {
    jest.resetAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    fakeCacheService = new FakeCacheService();

    target = new GelatoApi(
      mockGelatoClient,
      fakeConfigurationService,
      fakeCacheService,
      mockLoggingService,
    );
  });

  describe('getRelayCount', () => {
    it('should return the current count from the cache', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress();
      const cacheDir = new CacheDir(`${chainId}_relay_${address}`, '');
      const count = faker.number.int();

      await fakeCacheService.set(cacheDir, count.toString());

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toEqual(count);
    });

    it('should return 0 if the cache is empty', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress();

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toEqual(0);
    });
  });

  describe('relay', () => {
    it('should relay the payload', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      const taskId = faker.string.alphanumeric();
      fakeConfigurationService.set(`gelato.apiKey.${chainId}`, apiKey);
      mockGelatoClient.sponsoredCall.mockResolvedValue({ taskId });

      const result = await target.relay({
        chainId,
        to: address,
        data,
      });

      expect(result).toEqual({ taskId });
      expect(mockGelatoClient.sponsoredCall).toHaveBeenCalledWith(
        {
          chainId: BigInt(chainId),
          data,
          target: address,
        },
        apiKey,
        {
          gasLimit: undefined,
        },
      );
    });

    it('should add a gas buffer if a gas limit is provided', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const gasLimit = faker.number.bigInt();
      const apiKey = faker.string.sample();
      fakeConfigurationService.set(`gelato.apiKey.${chainId}`, apiKey);

      await target.relay({
        chainId,
        to: address,
        data,
        gasLimit,
      });

      expect(mockGelatoClient.sponsoredCall).toHaveBeenCalledWith(
        {
          chainId: BigInt(chainId),
          data,
          target: address,
        },
        apiKey,
        {
          gasLimit: gasLimit + BigInt(150_000),
        },
      );
    });

    it('should throw if there is no API key preset', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
        }),
      ).rejects.toThrow();
    });

    it('should increment the count after relaying', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      fakeConfigurationService.set(`gelato.apiKey.${chainId}`, apiKey);

      await target.relay({
        chainId,
        to: address,
        data,
      });

      const currentCount = await fakeCacheService.get(
        new CacheDir(`${chainId}_relay_${address}`, ''),
      );
      expect(currentCount).toEqual('1');
    });

    it('should not fail the relay if incrementing the count fails', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      fakeConfigurationService.set(`gelato.apiKey.${chainId}`, apiKey);
      // Incremeting the cache throws
      jest
        .spyOn(fakeCacheService, 'set')
        .mockRejectedValue(new Error('Setting cache threw an error'));

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
        }),
      ).resolves.not.toThrow();

      expect(fakeCacheService.set).toHaveBeenCalledTimes(1);
    });
  });
});
