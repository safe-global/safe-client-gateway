import { ConfigApi } from './config-api.service';
import { FakeConfigurationService } from '../../common/config/__tests__/fake.configuration.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { Page } from '../../common/entities/page.entity';

const CHAINS: Page<Chain> = {
  count: 2,
  results: [
    {
      chainId: '1',
      chainName: 'Ethereum',
      transactionService: 'https://safe-transaction.mainnet.gnosis.io',
      vpcTransactionService:
        'http://mainnet-safe-transaction-web.safe.svc.cluster.local',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        logoUri:
          'https://safe-transaction-assets.gnosis-safe.io/chains/1/currency_logo.png',
      },
    },
    {
      chainId: '100',
      chainName: 'Gnosis Chain',
      transactionService: 'https://safe-transaction.xdai.gnosis.io',
      vpcTransactionService:
        'http://xdai-safe-transaction-web.safe.svc.cluster.local',
      nativeCurrency: {
        name: 'xDai',
        symbol: 'XDAI',
        decimals: 18,
        logoUri:
          'https://safe-transaction-assets.gnosis-safe.io/chains/100/currency_logo.png',
      },
    },
  ],
};

const CHAIN: Chain = CHAINS.results[0];

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;

const mockDataSource = jest.mocked(dataSource);

describe('ConfigApi', () => {
  const fakeConfigurationService = new FakeConfigurationService();
  fakeConfigurationService.set('safeConfig.baseUri', 'nothing');

  const service: ConfigApi = new ConfigApi(
    dataSource,
    fakeConfigurationService,
  );

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();
    await expect(
      () =>
        new ConfigApi(
          dataSource,
          fakeConfigurationService,
        ),
    ).toThrow();
  });

  it('should return the chains retrieved', async () => {
    mockDataSource.get.mockResolvedValue(CHAINS);

    const chains = await service.getChains();

    expect(chains).toBe(CHAINS);
  });

  it('should return the chain retrieved', async () => {
    mockDataSource.get.mockResolvedValue(CHAIN);

    const chain = await service.getChain('1');

    expect(chain).toBe(CHAIN);
  });

  it('should forward error', async () => {
    mockDataSource.get = jest
      .fn()
      .mockRejectedValueOnce(new Error('Some error'));

    await expect(service.getChains()).rejects.toThrow('Some error');

    expect(mockDataSource.get).toHaveBeenCalledTimes(1);
  });
});
