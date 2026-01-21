import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { numberToHex } from 'viem';

const mockCacheService = jest.mocked({
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockLoggingService = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const zerionApiKey = faker.string.sample();
const zerionBaseUri = faker.internet.url({ appendSlash: false });
const chainsCacheTtlSeconds = faker.number.int({ min: 3600, max: 172800 });

describe('ZerionChainMappingService', () => {
  let service: ZerionChainMappingService;
  let fakeConfigurationService: FakeConfigurationService;

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.apiKey',
      zerionApiKey,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.baseUri',
      zerionBaseUri,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.chainsCacheTtlSeconds',
      chainsCacheTtlSeconds,
    );

    service = new ZerionChainMappingService(
      mockNetworkService,
      mockCacheService,
      fakeConfigurationService,
      mockLoggingService,
    );
  });

  describe('getNetworkNameFromChainId', () => {
    it('should return chain name from cached mapping', async () => {
      const cachedMappings = JSON.stringify({
        chainIdToName: { '1': 'ethereum', '137': 'polygon' },
        nameToChainId: { ethereum: '1', polygon: '137' },
      });
      mockCacheService.hGet.mockResolvedValue(cachedMappings);

      const result = await service.getNetworkNameFromChainId('1', false);

      expect(result).toBe('ethereum');
      expect(mockCacheService.hGet).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'mapping',
          key: 'zerion_chains',
        }),
      );
      expect(mockNetworkService.get).not.toHaveBeenCalled();
    });

    it('should return null for unknown chain ID', async () => {
      const cachedMappings = JSON.stringify({
        chainIdToName: { '1': 'ethereum' },
        nameToChainId: { ethereum: '1' },
      });
      mockCacheService.hGet.mockResolvedValue(cachedMappings);

      const result = await service.getNetworkNameFromChainId('999999', false);

      expect(result).toBeNull();
    });

    it('should fetch and cache mapping when not cached', async () => {
      mockCacheService.hGet.mockResolvedValue(null);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ethereum',
              attributes: {
                external_id: numberToHex(1),
                name: 'Ethereum',
                icon: null,
              },
            },
            {
              type: 'chain',
              id: 'polygon',
              attributes: {
                external_id: numberToHex(137),
                name: 'Polygon',
                icon: null,
              },
            },
          ],
        },
      };
      mockNetworkService.get.mockResolvedValue({
        data: rawify(mockResponse.data),
        status: 200,
      });

      const result = await service.getNetworkNameFromChainId('1', false);

      expect(result).toBe('ethereum');
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/chains`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
          },
        },
      });
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({ field: 'mapping' }),
        expect.stringContaining('"chainIdToName"'),
        chainsCacheTtlSeconds,
      );
    });

    it('should use testnet cache field when isTestnet is true', async () => {
      const cachedMappings = JSON.stringify({
        chainIdToName: { '11155111': 'ethereum' },
        nameToChainId: { ethereum: '11155111' },
      });
      mockCacheService.hGet.mockResolvedValue(cachedMappings);

      await service.getNetworkNameFromChainId('11155111', true);

      expect(mockCacheService.hGet).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'mapping_testnet',
        }),
      );
    });
  });

  describe('getChainIdFromNetworkName', () => {
    it('should return chain ID from cached mapping', async () => {
      const cachedMappings = JSON.stringify({
        chainIdToName: { '1': 'ethereum', '137': 'polygon' },
        nameToChainId: { ethereum: '1', polygon: '137' },
      });
      mockCacheService.hGet.mockResolvedValue(cachedMappings);

      const result = await service.getChainIdFromNetworkName('ethereum', false);

      expect(result).toBe('1');
    });

    it('should return null for unknown network name', async () => {
      const cachedMappings = JSON.stringify({
        chainIdToName: { '1': 'ethereum' },
        nameToChainId: { ethereum: '1' },
      });
      mockCacheService.hGet.mockResolvedValue(cachedMappings);

      const result = await service.getChainIdFromNetworkName('unknown', false);

      expect(result).toBeNull();
    });

    it('should handle case-insensitive network names', async () => {
      const cachedMappings = JSON.stringify({
        chainIdToName: { '1': 'ethereum' },
        nameToChainId: { ethereum: '1' },
      });
      mockCacheService.hGet.mockResolvedValue(cachedMappings);

      const result = await service.getChainIdFromNetworkName('ETHEREUM', false);

      expect(result).toBe('1');
    });
  });

  describe('combined cache', () => {
    it('should store both directions in single cache entry', async () => {
      mockCacheService.hGet.mockResolvedValue(null);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ethereum',
              attributes: {
                external_id: numberToHex(1),
                name: 'Ethereum',
                icon: null,
              },
            },
          ],
        },
      };
      mockNetworkService.get.mockResolvedValue({
        data: rawify(mockResponse.data),
        status: 200,
      });

      await service.getNetworkNameFromChainId('1', false);

      expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
      const cachedValue = JSON.parse(mockCacheService.hSet.mock.calls[0][1]);
      expect(cachedValue).toEqual({
        chainIdToName: { '1': 'ethereum' },
        nameToChainId: { ethereum: '1' },
      });
    });
  });

  describe('error handling', () => {
    it('should propagate error on fetch failure', async () => {
      mockCacheService.hGet.mockResolvedValue(null);
      mockNetworkService.get.mockRejectedValue(new Error('Network error'));

      await expect(
        service.getNetworkNameFromChainId('1', false),
      ).rejects.toThrow('Network error');
    });

    it('should skip chains with invalid hex external_id', async () => {
      mockCacheService.hGet.mockResolvedValue(null);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ethereum',
              attributes: {
                external_id: numberToHex(1),
                name: 'Ethereum',
                icon: null,
              },
            },
            {
              type: 'chain',
              id: 'invalid',
              attributes: {
                external_id: 'not-a-hex',
                name: 'Invalid',
                icon: null,
              },
            },
          ],
        },
      };
      mockNetworkService.get.mockResolvedValue({
        data: rawify(mockResponse.data),
        status: 200,
      });

      await service.getNetworkNameFromChainId('1', false);

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'Invalid external_id for chain invalid: not-a-hex',
      );
      const cachedValue = JSON.parse(mockCacheService.hSet.mock.calls[0][1]);
      expect(cachedValue.chainIdToName).not.toHaveProperty('invalid');
    });
  });

  describe('testnet requests', () => {
    it('should include X-Env header for testnet requests', async () => {
      mockCacheService.hGet.mockResolvedValue(null);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ethereum',
              attributes: {
                external_id: numberToHex(11155111),
                name: 'Ethereum',
                icon: null,
              },
            },
          ],
        },
      };
      mockNetworkService.get.mockResolvedValue({
        data: rawify(mockResponse.data),
        status: 200,
      });

      await service.getNetworkNameFromChainId('11155111', true);

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/chains`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
            'X-Env': 'testnet',
          },
        },
      });
    });

    it('should cache testnet mappings separately', async () => {
      mockCacheService.hGet.mockResolvedValue(null);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ethereum',
              attributes: {
                external_id: numberToHex(11155111),
                name: 'Ethereum',
                icon: null,
              },
            },
          ],
        },
      };
      mockNetworkService.get.mockResolvedValue({
        data: rawify(mockResponse.data),
        status: 200,
      });

      await service.getNetworkNameFromChainId('11155111', true);

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'mapping_testnet',
        }),
        expect.any(String),
        chainsCacheTtlSeconds,
      );
    });
  });
});
