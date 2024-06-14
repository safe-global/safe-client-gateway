import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
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
  const infuraApiKey = faker.string.hexadecimal({ length: 32 });

  beforeEach(() => {
    jest.resetAllMocks();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('blockchain.infura.apiKey', infuraApiKey);
    target = new BlockchainApiManager(fakeConfigurationService, configApiMock);
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
});
