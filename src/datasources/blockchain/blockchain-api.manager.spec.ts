import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { rpcUriBuilder } from '@/domain/chains/entities/__tests__/rpc-uri.builder';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import type { RedisClientType } from 'redis';
import { hexToNumber, toHex } from 'viem';

const configApiMock = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>);

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('BlockchainApiManager', () => {
  let target: BlockchainApiManager;
  let redisCacheService: RedisCacheService;
  let redisClient: RedisClientType;
  const infuraApiKey = faker.string.hexadecimal({ length: 32 });
  const expirationTimeInSeconds = faker.number.int();

  beforeAll(async () => {
    redisClient = await redisClientFactory(
      faker.number.int({ min: 1, max: 10 }),
    );
    redisCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      mockConfigurationService,
      crypto.randomUUID(),
    );
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('blockchain.infura.apiKey', infuraApiKey);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.rpc',
      expirationTimeInSeconds,
    );
    target = new BlockchainApiManager(
      fakeConfigurationService,
      configApiMock,
      redisCacheService,
    );
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await redisClient.flushAll();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('getApi', () => {
    it('caches the API', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getApi(chain.chainId);
      const cachedApi = await target.getApi(chain.chainId);

      expect(api).toBe(cachedApi);
    });

    it('should include the INFURA_API_KEY in the RPC URI for an Infura URI with API_KEY_PATH authentication', async () => {
      const rpcUriValue = `https://${faker.string.sample()}.infura.io/v3/`;
      const chain = chainBuilder()
        .with(
          'rpcUri',
          rpcUriBuilder()
            .with('value', rpcUriValue)
            .with('authentication', RpcUriAuthentication.ApiKeyPath)
            .build(),
        )
        .build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getApi(chain.chainId);

      expect(api.chain?.rpcUrls.default.http[0]).toContain(infuraApiKey);
    });

    it('should not include the INFURA_API_KEY in the RPC URI for an Infura URI without API_KEY_PATH authentication', async () => {
      const rpcUriValue = `https://${faker.string.sample()}.infura.io/v3/`;
      const chain = chainBuilder()
        .with('rpcUri', rpcUriBuilder().with('value', rpcUriValue).build())
        .build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getApi(chain.chainId);

      expect(api.chain?.rpcUrls.default.http[0]).not.toContain(infuraApiKey);
    });

    it('should not include the INFURA_API_KEY in the RPC URI for a RPC provider different from Infura', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getApi(chain.chainId);

      expect(api.chain?.rpcUrls.default.http[0]).not.toContain(infuraApiKey);
    });
  });

  describe('destroyApi', () => {
    it('clears the API', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getApi(chain.chainId);
      target.destroyApi(chain.chainId);
      const cachedApi = await target.getApi(chain.chainId);

      expect(api).not.toBe(cachedApi);
    });
  });

  describe('createCachedRpcClient', () => {
    it('caches string response RPC requests', async () => {
      const chain = chainBuilder().build();
      const client = target._createCachedRpcClient(chain);
      const fetchSpy = jest.spyOn(global, 'fetch');
      const chainId = toHex(chain.chainId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fetchSpy.mockImplementation((_: unknown) => {
        return Promise.resolve({
          headers: new Headers({ 'Content-Type': 'application/json' }),
          ok: true,
          status: 200,
          json: () => {
            // Return chain ID
            return Promise.resolve({
              result: chainId,
            });
          },
        } as Response);
      });
      const body = {
        jsonrpc: '2.0',
        id: 0,
        method: 'eth_chainId',
      };
      const cacheDir = new CacheDir(
        `${chain.chainId}_rpc_requests`,
        `${body.method}_undefined`,
      );

      await expect(client.getChainId()).resolves.toBe(hexToNumber(chainId));

      // Should be cached
      await client.getChainId();
      await client.getChainId();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenNthCalledWith(1, chain.rpcUri.value, {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: expect.any(AbortSignal),
      });
      const cached = await redisCacheService.hGet(cacheDir);
      expect(JSON.parse(cached!)).toBe(chainId);

      fetchSpy.mockRestore();
    });

    it('caches non-string response RPC requests', async () => {
      const chain = chainBuilder().build();
      const client = target._createCachedRpcClient(chain);
      const fetchSpy = jest.spyOn(global, 'fetch');
      const blockByNumber = {
        baseFeePerGas: null,
        hash: null,
        logsBloom: null,
        nonce: null,
        number: null,
        totalDifficulty: null,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fetchSpy.mockImplementation((_: unknown) => {
        return Promise.resolve({
          headers: new Headers({ 'Content-Type': 'application/json' }),
          ok: true,
          status: 200,
          json: () => {
            // Return chain ID
            return Promise.resolve({
              result: blockByNumber,
            });
          },
        } as Response);
      });
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      };
      const cacheDir = new CacheDir(
        `${chain.chainId}_rpc_requests`,
        `${body.method}_${JSON.stringify(body.params)}`,
      );

      await expect(client.getBlock()).resolves.toStrictEqual(
        // Object containing in order not to mock entire return type
        expect.objectContaining(blockByNumber),
      );

      // Should be cached
      await client.getBlock();
      await client.getBlock();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenNthCalledWith(1, chain.rpcUri.value, {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: expect.any(AbortSignal),
      });
      const cached = await redisCacheService.hGet(cacheDir);
      expect(JSON.parse(cached!)).toStrictEqual(blockByNumber);

      fetchSpy.mockRestore();
    });
  });
});
