import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { BlockchainDataSource } from '@/datasources/blockchain/blockchain.datasource';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';

const chainsRepository = {
  getChain: jest.fn(),
} as unknown as IChainsRepository;
const chainsRepositoryMock = jest.mocked(chainsRepository);

const createPublicClient = jest.fn();
const createPublicClientMock = jest.mocked(createPublicClient);

describe('BlockchainDataSource', () => {
  let fakeConfigurationService: FakeConfigurationService;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
  });

  it('returns a public client without authentication', async () => {
    const chain = chainBuilder()
      .with('rpcUri', {
        authentication: RpcUriAuthentication.NoAuthentication,
        value: faker.internet.url(),
      })
      .build();
    chainsRepositoryMock.getChain.mockResolvedValue(chain);

    const target = new BlockchainDataSource(
      chainsRepositoryMock,
      fakeConfigurationService,
      createPublicClientMock,
    );

    await target.getPublicClient(chain.chainId);

    expect(createPublicClientMock).toHaveBeenCalledWith({
      chain: {
        id: Number(chain.chainId),
        name: chain.chainName,
        network: chain.chainName.toLowerCase(),
        nativeCurrency: {
          name: chain.nativeCurrency.name,
          symbol: chain.nativeCurrency.symbol,
          decimals: chain.nativeCurrency.decimals,
        },
        rpcUrls: {
          default: {
            http: [chain.rpcUri.value],
          },
          public: {
            http: [chain.rpcUri.value],
          },
        },
      },
      transport: expect.any(Function),
    });
  });

  it('returns a public client with authentication', async () => {
    const chain = chainBuilder()
      .with('rpcUri', {
        authentication: RpcUriAuthentication.ApiKeyPath,
        value: faker.internet.url(),
      })
      .build();
    chainsRepositoryMock.getChain.mockResolvedValue(chain);
    const apiKey = faker.string.alphanumeric();
    fakeConfigurationService.set('blockchain.infuraToken', apiKey);

    const target = new BlockchainDataSource(
      chainsRepositoryMock,
      fakeConfigurationService,
      createPublicClientMock,
    );

    await target.getPublicClient(chain.chainId);

    expect(createPublicClientMock).toHaveBeenCalledWith({
      chain: {
        id: Number(chain.chainId),
        name: chain.chainName,
        network: chain.chainName.toLowerCase(),
        nativeCurrency: {
          name: chain.nativeCurrency.name,
          symbol: chain.nativeCurrency.symbol,
          decimals: chain.nativeCurrency.decimals,
        },
        rpcUrls: {
          default: {
            http: [chain.rpcUri.value + apiKey],
          },
          public: {
            http: [chain.rpcUri.value + apiKey],
          },
        },
      },
      transport: expect.any(Function),
    });
  });
});
