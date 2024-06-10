import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { BlockchainApiManager } from '@/datasources/blockchain/blockchain-api.manager';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { faker } from '@faker-js/faker';

const configApiMock = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>);

describe('BlockchainApiManager', () => {
  let target: BlockchainApiManager;

  beforeEach(() => {
    jest.resetAllMocks();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'blockchain.infura.apiKey',
      faker.string.hexadecimal({ length: 32 }),
    );
    target = new BlockchainApiManager(fakeConfigurationService, configApiMock);
  });

  describe('getBlockchainApi', () => {
    it('caches the API', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getBlockchainApi(chain.chainId);
      const cachedApi = await target.getBlockchainApi(chain.chainId);

      expect(api === cachedApi);
    });
  });

  describe('destroyBlockchainApi', () => {
    it('destroys the API', async () => {
      const chain = chainBuilder().build();
      configApiMock.getChain.mockResolvedValue(chain);

      const api = await target.getBlockchainApi(chain.chainId);
      api.destroyClient(chain.chainId);
      const cachedApi = await target.getBlockchainApi(chain.chainId);

      expect(api !== cachedApi);
    });
  });
});
