import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { rpcUriBuilder } from '@/domain/chains/entities/__tests__/rpc-uri.builder';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { faker } from '@faker-js/faker';

const configApiMock = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>);

describe('BlockchainApiManager', () => {
  let target: BlockchainApiManager;
  let fakeCacheService: FakeCacheService;
  const infuraApiKey = faker.string.hexadecimal({ length: 32 });
  const expirationTimeInSeconds = faker.number.int();

  beforeEach(() => {
    jest.resetAllMocks();

    fakeCacheService = new FakeCacheService();
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('blockchain.infura.apiKey', infuraApiKey);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.rpc',
      expirationTimeInSeconds,
    );
    target = new BlockchainApiManager(
      fakeConfigurationService,
      configApiMock,
      fakeCacheService,
    );
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
      await target.destroyApi(chain.chainId);
      const cachedApi = await target.getApi(chain.chainId);

      expect(api).not.toBe(cachedApi);
    });
  });

  describe('createCachedRpcClient', () => {
    it('caches RPC requests', async () => {
      const chain = chainBuilder().build();
      const client = target._createCachedRpcClient(chain);
      const fetchSpy = jest.spyOn(global, 'fetch');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fetchSpy.mockImplementation((_: unknown) => {
        return Promise.resolve({
          headers: new Headers({ 'Content-Type': 'application/json' }),
          ok: true,
          status: 200,
          json: () => {
            // Return chain ID
            return Promise.resolve({
              result: faker.string.hexadecimal(),
            });
          },
        } as Response);
      });

      await client.getChainId();

      // Should be cached
      await client.getChainId();
      await client.getChainId();

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenNthCalledWith(1, chain.rpcUri.value, {
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'eth_chainId',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: expect.any(AbortSignal),
      });

      fetchSpy.mockRestore();
    });
  });
});
