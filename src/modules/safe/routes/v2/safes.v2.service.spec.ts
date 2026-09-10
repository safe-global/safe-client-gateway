// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { ZerionWalletPortfolio } from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import type { IZerionWalletPortfolioApi } from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import type { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import { balanceBuilder } from '@/modules/balances/domain/entities/__tests__/balance.builder';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { SafesV2Service } from '@/modules/safe/routes/v2/safes.v2.service';
import type { IZerionRepository } from '@/modules/zerion/domain/zerion.repository.interface';

const mockSafeRepository = vi.mocked({
  getSafe: vi.fn(),
  getTransactionQueue: vi.fn(),
} as MockedObject<ISafeRepository>);

const mockChainsRepository = vi.mocked({
  getChain: vi.fn(),
} as MockedObject<IChainsRepository>);

const mockBalancesRepository = vi.mocked({
  getBalances: vi.fn(),
} as MockedObject<IBalancesRepository>);

const mockZerionWalletPortfolioApi = vi.mocked({
  getPortfolio: vi.fn(),
} as MockedObject<IZerionWalletPortfolioApi>);

const mockLoggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
} as MockedObject<ILoggingService>;

const mockZerionRepository = vi.mocked({
  getNetworkNamesByChainId: vi.fn(),
} as MockedObject<IZerionRepository>);

// Chains Zerion lists per environment, keyed by chainId; anything else is unsupported.
const zerionNetworks: Record<'mainnet' | 'testnet', Record<string, string>> = {
  mainnet: { '1': 'ethereum', '137': 'polygon' },
  testnet: { '11155111': 'sepolia' },
};

const buildChain = (chainId: string, isTestnet = false): Chain =>
  chainBuilder().with('chainId', chainId).with('isTestnet', isTestnet).build();

const buildPortfolio = (
  byChain: Record<string, number>,
): ZerionWalletPortfolio => ({
  data: {
    type: 'portfolio',
    id: faker.string.uuid(),
    attributes: {
      total: { positions: Object.values(byChain).reduce((a, b) => a + b, 0) },
      positions_distribution_by_chain: byChain,
    },
  },
});

describe('SafesV2Service', () => {
  let service: SafesV2Service;

  beforeEach(() => {
    vi.resetAllMocks();
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('mappings.safe.maxOverviews', 10);
    fakeConfigurationService.set('features.zerion', true);

    service = new SafesV2Service(
      mockSafeRepository,
      mockChainsRepository,
      mockBalancesRepository,
      mockZerionWalletPortfolioApi,
      fakeConfigurationService,
      mockLoggingService,
      mockZerionRepository,
    );

    mockSafeRepository.getSafe.mockImplementation(({ address }) =>
      Promise.resolve(safeBuilder().with('address', address).build()),
    );
    mockSafeRepository.getTransactionQueue.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    mockZerionRepository.getNetworkNamesByChainId.mockImplementation(
      (isTestnet) =>
        Promise.resolve(zerionNetworks[isTestnet ? 'testnet' : 'mainnet']),
    );
  });

  it('fetches one portfolio for a multi-chain wallet and maps distinct per-chain values', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const chains: Record<string, Chain> = {
      '1': buildChain('1'),
      '137': buildChain('137'),
    };
    mockChainsRepository.getChain.mockImplementation((chainId: string) =>
      Promise.resolve(chains[chainId]),
    );
    mockZerionWalletPortfolioApi.getPortfolio.mockResolvedValue(
      buildPortfolio({ ethereum: 100, polygon: 50 }),
    );

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [
        { chainId: '1', address },
        { chainId: '137', address },
      ],
      trusted: false,
    });

    expect(mockZerionWalletPortfolioApi.getPortfolio).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result.find((o) => o.chainId === '1')?.fiatTotal).toBe('100');
    expect(result.find((o) => o.chainId === '137')?.fiatTotal).toBe('50');
    expect(mockBalancesRepository.getBalances).not.toHaveBeenCalled();
  });

  it('fetches two portfolios for the same address across mainnet and testnet', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const chains: Record<string, Chain> = {
      '1': buildChain('1'),
      '11155111': buildChain('11155111', true),
    };
    mockChainsRepository.getChain.mockImplementation((chainId: string) =>
      Promise.resolve(chains[chainId]),
    );
    mockZerionWalletPortfolioApi.getPortfolio.mockResolvedValue(
      buildPortfolio({ ethereum: 10, sepolia: 5 }),
    );

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [
        { chainId: '1', address },
        { chainId: '11155111', address },
      ],
      trusted: false,
    });

    expect(mockZerionWalletPortfolioApi.getPortfolio).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('uses the portfolio for Zerion-listed chains and the balances repo for others, deduping getChain', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const chains: Record<string, Chain> = {
      '1': buildChain('1'),
      '10': buildChain('10'),
    };
    mockChainsRepository.getChain.mockImplementation((chainId: string) =>
      Promise.resolve(chains[chainId]),
    );
    mockZerionWalletPortfolioApi.getPortfolio.mockResolvedValue(
      buildPortfolio({ ethereum: 100 }),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', '7').build(),
    ]);

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [
        { chainId: '1', address },
        { chainId: '1', address: getAddress(faker.finance.ethereumAddress()) },
        { chainId: '10', address },
      ],
      trusted: false,
    });

    // getChain called once per unique chainId (1 and 10), not per entry.
    expect(mockChainsRepository.getChain).toHaveBeenCalledTimes(2);
    expect(mockBalancesRepository.getBalances).toHaveBeenCalledTimes(1);
    expect(result.find((o) => o.chainId === '10')?.fiatTotal).toBe('7');
    expect(result).toHaveLength(3);
  });

  it('degrades a failed portfolio to the balances repo without dropping the Safe or fabricating $0', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('1'));
    mockZerionWalletPortfolioApi.getPortfolio.mockRejectedValue(
      new Error('429 Too Many Requests'),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', '42').build(),
      balanceBuilder().with('fiatBalance', '8').build(),
    ]);

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '1', address }],
      trusted: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].fiatTotal).toBe('50');
    expect(mockBalancesRepository.getBalances).toHaveBeenCalledTimes(1);
  });

  it('does not fetch the portfolio for a non-Safe address and drops the entry', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('1'));
    // Address is not a Safe — getSafe rejects.
    mockSafeRepository.getSafe.mockRejectedValue(new Error('Not a Safe'));

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '1', address }],
      trusted: false,
    });

    expect(result).toHaveLength(0);
    // The Safe is validated first, so no Zerion budget is spent on a non-Safe.
    expect(mockZerionWalletPortfolioApi.getPortfolio).not.toHaveBeenCalled();
  });

  it('drops the Safe (never $0) when both the portfolio and the balances repo fail', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('1'));
    mockZerionWalletPortfolioApi.getPortfolio.mockRejectedValue(
      new Error('429'),
    );
    mockBalancesRepository.getBalances.mockRejectedValue(
      new Error('balances upstream down'),
    );

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '1', address }],
      trusted: false,
    });

    expect(result).toHaveLength(0);
  });

  it('falls back to the balances repo (not $0) for a chain Zerion does not list', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('10'));
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', '15').build(),
    ]);

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '10', address }],
      trusted: false,
    });

    expect(mockZerionWalletPortfolioApi.getPortfolio).not.toHaveBeenCalled();
    expect(result[0].fiatTotal).toBe('15');
  });

  it('falls back to the balances repo (not $0) when the Zerion chain lookup fails', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('1'));
    mockZerionRepository.getNetworkNamesByChainId.mockRejectedValue(
      new Error('Zerion unavailable'),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', '12').build(),
    ]);

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '1', address }],
      trusted: false,
    });

    expect(mockZerionWalletPortfolioApi.getPortfolio).not.toHaveBeenCalled();
    expect(result[0].fiatTotal).toBe('12');
  });

  it('ignores non-finite token balances in the fallback reducer', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('10'));
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', '20').build(),
      balanceBuilder().with('fiatBalance', 'not-a-number').build(),
    ]);

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '10', address }],
      trusted: false,
    });

    expect(result[0].fiatTotal).toBe('20');
  });

  it('returns a real $0 for an enabled chain absent from the portfolio distribution', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockChainsRepository.getChain.mockResolvedValue(buildChain('1'));
    // Wallet holds nothing on ethereum — chain key absent from distribution.
    mockZerionWalletPortfolioApi.getPortfolio.mockResolvedValue(
      buildPortfolio({ polygon: 30 }),
    );

    const result = await service.getSafeOverview({
      currency: 'USD',
      addresses: [{ chainId: '1', address }],
      trusted: false,
    });

    expect(result[0].fiatTotal).toBe('0');
    expect(mockBalancesRepository.getBalances).not.toHaveBeenCalled();
  });
});
