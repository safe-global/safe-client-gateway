import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { numberToHex } from 'viem';
import { CacheRouter } from '@/datasources/cache/cache.router';

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

describe('ZerionChainMappingService', () => {
  let service: ZerionChainMappingService;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });

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

    service = new ZerionChainMappingService(
      mockNetworkService,
      fakeConfigurationService,
      mockLoggingService,
      mockCacheService,
    );
  });

  describe('constructor', () => {
    it('should initialize with configuration values', () => {
      expect(service).toBeDefined();
    });

    it('should handle undefined API key', () => {
      fakeConfigurationService.set(
        'balances.providers.zerion.apiKey',
        undefined,
      );

      const newService = new ZerionChainMappingService(
        mockNetworkService,
        fakeConfigurationService,
        mockLoggingService,
        mockCacheService,
      );

      expect(newService).toBeDefined();
    });
  });

  describe('getChainIdFromNetwork', () => {
    const testMapping = {
      ethereum: '1',
      polygon: '137',
      arbitrum: '42161',
    };

    it('should return chain ID from cached mapping', async () => {
      const cachedMapping = JSON.stringify(testMapping);
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      const result = await service.getChainIdFromNetwork('ethereum', false);

      expect(result).toBe('1');
      expect(mockCacheService.hGet).toHaveBeenCalled();
      expect(mockNetworkService.get).not.toHaveBeenCalled();
    });

    it('should fetch and cache mapping when not cached', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      const result = await service.getChainIdFromNetwork('ethereum', false);

      expect(result).toBe('1');
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/chains`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
          },
        },
      });
      expect(mockCacheService.hSet).toHaveBeenCalled();
    });

    it('should return default chain ID 1 for unknown network', async () => {
      const cachedMapping = JSON.stringify(testMapping);
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      const result = await service.getChainIdFromNetwork('unknown', false);

      expect(result).toBe('1');
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'Unknown Zerion network: "unknown", defaulting to Ethereum mainnet (chain ID 1)',
      );
    });

    it('should handle case-insensitive network names', async () => {
      const cachedMapping = JSON.stringify(testMapping);
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      const result = await service.getChainIdFromNetwork('ETHEREUM', false);

      expect(result).toBe('1');
    });

    it('should use testnet cache when isTestnet is true', async () => {
      const cachedMapping = JSON.stringify({ ethereum: '11155111' });
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      await service.getChainIdFromNetwork('ethereum', true);

      const cacheCall = mockCacheService.hGet.mock.calls[0][0];
      expect(cacheCall.field).toBe('mapping_testnet');
    });
  });

  describe('getNetworkFromChainId', () => {
    const testReverseMapping = {
      '1': 'ethereum',
      '137': 'polygon',
      '42161': 'arbitrum',
    };

    it('should return network name from cached reverse mapping', async () => {
      const cachedMapping = JSON.stringify(testReverseMapping);
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      const result = await service.getNetworkFromChainId('1', false);

      expect(result).toBe('ethereum');
      expect(mockCacheService.hGet).toHaveBeenCalled();
    });

    it('should build reverse mapping when not cached', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      const result = await service.getNetworkFromChainId('1', false);

      expect(result).toBe('ethereum');
      expect(mockCacheService.hSet).toHaveBeenCalledTimes(2); // networkToChainId and chainIdToNetwork
    });

    it('should return undefined for unknown chain ID', async () => {
      const cachedMapping = JSON.stringify(testReverseMapping);
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      const result = await service.getNetworkFromChainId('999', false);

      expect(result).toBeUndefined();
    });

    it('should use testnet reverse cache when isTestnet is true', async () => {
      const cachedMapping = JSON.stringify(testReverseMapping);
      mockCacheService.hGet.mockResolvedValue(cachedMapping);

      await service.getNetworkFromChainId('11155111', true);

      const cacheCall = mockCacheService.hGet.mock.calls[0][0];
      expect(cacheCall.field).toBe('mapping_reverse_testnet');
    });
  });

  describe('_fetchAndCacheMapping', () => {
    it('should parse and map Zerion chain response correctly', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ethereum',
              attributes: {
                external_id: numberToHex(1),
                name: 'Ethereum',
                icon: { url: 'https://example.com/eth.png' },
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

      await service.getChainIdFromNetwork('ethereum', false);

      expect(mockNetworkService.get).toHaveBeenCalled();
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'mapping',
        }),
        expect.stringContaining('"ethereum":"1"'),
        86400,
      );
    });

    it('should skip chains with invalid hex external_id', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getChainIdFromNetwork('ethereum', false);

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'Invalid external_id for chain invalid: not-a-hex',
      );
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('"ethereum":"1"'),
        86400,
      );
      // Should not include invalid chain
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.not.stringContaining('invalid'),
        86400,
      );
    });

    it('should convert network names to lowercase in mapping', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
      const mockResponse = {
        data: {
          data: [
            {
              type: 'chain',
              id: 'ETHEREUM',
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

      const result = await service.getChainIdFromNetwork('ethereum', false);

      expect(result).toBe('1');
    });

    it('should include X-Env header for testnet requests', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getChainIdFromNetwork('ethereum', true);

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
  });

  describe('caching', () => {
    it('should cache networkToChainId mapping with correct TTL', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getChainIdFromNetwork('ethereum', false);

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'mapping',
        }),
        expect.any(String),
        86400, // 24 hours
      );
    });

    it('should cache chainIdToNetwork mapping separately', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getNetworkFromChainId('1', false);

      // Should cache both directions
      const hSetCalls = mockCacheService.hSet.mock.calls;
      expect(hSetCalls.length).toBeGreaterThanOrEqual(2);
      const reverseCacheCall = hSetCalls.find(
        (call) => call[0].field === 'mapping_reverse',
      );
      expect(reverseCacheCall).toBeDefined();
    });

    it('should use different cache fields for testnet', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getChainIdFromNetwork('ethereum', true);

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'mapping_testnet',
        }),
        expect.any(String),
        86400,
      );
    });
  });

  describe('cache direction parameter', () => {
    it('should use correct cache field for networkToChainId direction (mainnet)', async () => {
      const testMapping = { ethereum: '1' };
      mockCacheService.hGet.mockResolvedValue(JSON.stringify(testMapping));

      await service.getChainIdFromNetwork('ethereum', false);

      const cacheCall = mockCacheService.hGet.mock.calls[0][0];
      expect(cacheCall.field).toBe('mapping');
      expect(cacheCall.key).toBe('zerion_chains');
    });

    it('should use correct cache field for networkToChainId direction (testnet)', async () => {
      const testMapping = { ethereum: '11155111' };
      mockCacheService.hGet.mockResolvedValue(JSON.stringify(testMapping));

      await service.getChainIdFromNetwork('ethereum', true);

      const cacheCall = mockCacheService.hGet.mock.calls[0][0];
      expect(cacheCall.field).toBe('mapping_testnet');
      expect(cacheCall.key).toBe('zerion_chains');
    });

    it('should use correct cache field for chainIdToNetwork direction (mainnet)', async () => {
      const testReverseMapping = { '1': 'ethereum' };
      mockCacheService.hGet.mockResolvedValue(
        JSON.stringify(testReverseMapping),
      );

      await service.getNetworkFromChainId('1', false);

      const cacheCall = mockCacheService.hGet.mock.calls[0][0];
      expect(cacheCall.field).toBe('mapping_reverse');
      expect(cacheCall.key).toBe('zerion_chains');
    });

    it('should use correct cache field for chainIdToNetwork direction (testnet)', async () => {
      const testReverseMapping = { '11155111': 'ethereum' };
      mockCacheService.hGet.mockResolvedValue(
        JSON.stringify(testReverseMapping),
      );

      await service.getNetworkFromChainId('11155111', true);

      const cacheCall = mockCacheService.hGet.mock.calls[0][0];
      expect(cacheCall.field).toBe('mapping_reverse_testnet');
      expect(cacheCall.key).toBe('zerion_chains');
    });

    it('should cache networkToChainId mapping with correct field when fetching from API', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getChainIdFromNetwork('ethereum', false);

      const hSetCalls = mockCacheService.hSet.mock.calls;
      const networkToChainIdCall = hSetCalls.find(
        (call) => call[0].field === 'mapping',
      );
      expect(networkToChainIdCall).toBeDefined();
      expect(networkToChainIdCall![0].key).toBe('zerion_chains');
    });

    it('should cache chainIdToNetwork mapping with correct field when building reverse mapping', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getNetworkFromChainId('1', false);

      const hSetCalls = mockCacheService.hSet.mock.calls;
      // Should cache both directions
      expect(hSetCalls.length).toBe(2);

      const networkToChainIdCall = hSetCalls.find(
        (call) => call[0].field === 'mapping',
      );
      expect(networkToChainIdCall).toBeDefined();
      expect(networkToChainIdCall![0].key).toBe('zerion_chains');

      const chainIdToNetworkCall = hSetCalls.find(
        (call) => call[0].field === 'mapping_reverse',
      );
      expect(chainIdToNetworkCall).toBeDefined();
      expect(chainIdToNetworkCall![0].key).toBe('zerion_chains');
      // Verify the reverse mapping contains correct data
      const reverseMapping = JSON.parse(chainIdToNetworkCall![1]);
      expect(reverseMapping['1']).toBe('ethereum');
      expect(reverseMapping['137']).toBe('polygon');
    });

    it('should use correct cache fields for both directions in testnet', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getNetworkFromChainId('11155111', true);

      const hSetCalls = mockCacheService.hSet.mock.calls;
      expect(hSetCalls.length).toBe(2);

      const networkToChainIdCall = hSetCalls.find(
        (call) => call[0].field === 'mapping_testnet',
      );
      expect(networkToChainIdCall).toBeDefined();

      const chainIdToNetworkCall = hSetCalls.find(
        (call) => call[0].field === 'mapping_reverse_testnet',
      );
      expect(chainIdToNetworkCall).toBeDefined();
    });

    it('should not override cache field - field should come from CacheRouter', async () => {
      const getZerionChainsCacheDirSpy = jest.spyOn(
        CacheRouter,
        'getZerionChainsCacheDir',
      );

      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getChainIdFromNetwork('ethereum', false);

      expect(getZerionChainsCacheDirSpy).toHaveBeenCalledWith(
        false,
        'networkToChainId',
      );

      // Verify the cache field used matches what CacheRouter returns
      const cacheDir = CacheRouter.getZerionChainsCacheDir(
        false,
        'networkToChainId',
      );
      const hSetCall = mockCacheService.hSet.mock.calls[0];
      expect(hSetCall[0].field).toBe(cacheDir.field);
      expect(hSetCall[0].key).toBe(cacheDir.key);

      getZerionChainsCacheDirSpy.mockRestore();
    });

    it('should use CacheRouter field for chainIdToNetwork direction without overriding', async () => {
      const getZerionChainsCacheDirSpy = jest.spyOn(
        CacheRouter,
        'getZerionChainsCacheDir',
      );

      mockCacheService.hGet.mockResolvedValue(undefined);
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

      await service.getNetworkFromChainId('1', false);

      expect(getZerionChainsCacheDirSpy).toHaveBeenCalledWith(
        false,
        'chainIdToNetwork',
      );

      // Find the reverse mapping cache call
      const reverseCacheCall = mockCacheService.hSet.mock.calls.find(
        (call) => call[0].field === 'mapping_reverse',
      );
      expect(reverseCacheCall).toBeDefined();

      // Verify the field matches what CacheRouter returns
      const cacheDir = CacheRouter.getZerionChainsCacheDir(
        false,
        'chainIdToNetwork',
      );
      expect(reverseCacheCall![0].field).toBe(cacheDir.field);
      expect(reverseCacheCall![0].key).toBe(cacheDir.key);

      getZerionChainsCacheDirSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle network service errors gracefully', async () => {
      mockCacheService.hGet.mockResolvedValue(undefined);
      mockNetworkService.get.mockRejectedValue(new Error('Network error'));

      await expect(
        service.getChainIdFromNetwork('ethereum', false),
      ).rejects.toThrow('Network error');
    });

    it('should handle invalid JSON in cache', async () => {
      mockCacheService.hGet.mockResolvedValue('invalid-json');

      await expect(
        service.getChainIdFromNetwork('ethereum', false),
      ).rejects.toThrow();
    });
  });
});
