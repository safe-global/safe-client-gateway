// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { getNumberString } from '#/domain/common/utils/utils';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IBalancesRepository } from '#/modules/balances/domain/balances.repository.interface';
import { balanceBuilder } from '#/modules/balances/domain/entities/__tests__/balance.builder';
import { portfolioSnapshotBuilder } from '#/modules/balances/domain/entities/__tests__/portfolio-snapshot.builder';
import type { IPortfolioSnapshotRepository } from '#/modules/balances/domain/portfolio-snapshot.repository.interface';
import { PortfolioSummariesV2Service } from '#/modules/balances/routes/v2/portfolio-summaries.v2.service';
import type { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { IZerionRepository } from '#/modules/zerion/domain/zerion.repository.interface';

const mockChainsRepository = vi.mocked({
  getChain: vi.fn(),
} as unknown as MockedObject<IChainsRepository>);

const mockSafeRepository = vi.mocked({
  getSafe: vi.fn(),
} as unknown as MockedObject<ISafeRepository>);

const mockZerionRepository = vi.mocked({
  getChainIdToNetworkMapping: vi.fn(),
} as MockedObject<IZerionRepository>);

const mockPortfolioSnapshotRepository = vi.mocked({
  getSnapshot: vi.fn(),
} as MockedObject<IPortfolioSnapshotRepository>);

const mockBalancesRepository = vi.mocked({
  getBalances: vi.fn(),
} as unknown as MockedObject<IBalancesRepository>);

const mockLoggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
} as MockedObject<ILoggingService>;

// Chains Zerion lists per environment, keyed by chainId; anything else is unsupported.
const zerionNetworks: Record<'mainnet' | 'testnet', Record<string, string>> = {
  mainnet: { '1': 'ethereum', '137': 'polygon' },
  testnet: { '11155111': 'sepolia' },
};
const unsupportedChainId = '100';

const buildChain = (chainId: string, isTestnet = false): Chain =>
  chainBuilder().with('chainId', chainId).with('isTestnet', isTestnet).build();

const chainsById: Record<string, Chain> = {
  '1': buildChain('1'),
  '137': buildChain('137'),
  [unsupportedChainId]: buildChain(unsupportedChainId),
  '11155111': buildChain('11155111', true),
};

describe('PortfolioSummariesV2Service', () => {
  const currency = 'USD';
  const maxSafes = 5;
  let fakeConfigurationService: FakeConfigurationService;
  let service: PortfolioSummariesV2Service;

  const buildService = (): PortfolioSummariesV2Service =>
    new PortfolioSummariesV2Service(
      mockChainsRepository,
      mockSafeRepository,
      mockZerionRepository,
      mockPortfolioSnapshotRepository,
      mockBalancesRepository,
      fakeConfigurationService,
      mockLoggingService,
    );

  const randomAddress = (): Address =>
    getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    vi.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('mappings.safe.maxOverviews', maxSafes);
    fakeConfigurationService.set('features.zerion', true);
    fakeConfigurationService.set('features.zerionTestnets', false);
    fakeConfigurationService.set('balances.providers.zerion.currencies', [
      'USD',
      'EUR',
    ]);
    service = buildService();

    mockChainsRepository.getChain.mockImplementation((chainId) => {
      const chain = chainsById[chainId];
      return chain
        ? Promise.resolve(chain)
        : Promise.reject(new Error('Chain not found'));
    });
    mockSafeRepository.getSafe.mockImplementation(({ address }) =>
      Promise.resolve(safeBuilder().with('address', address).build()),
    );
    mockZerionRepository.getChainIdToNetworkMapping.mockImplementation(
      (isTestnet) =>
        Promise.resolve(
          isTestnet ? zerionNetworks.testnet : zerionNetworks.mainnet,
        ),
    );
  });

  it('rejects an unsupported currency before any upstream call', async () => {
    await expect(
      service.getSummaries({
        safes: [{ chainId: '1', address: randomAddress() }],
        currency: 'XYZ',
        trusted: false,
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        'Unsupported currency code: XYZ',
        HttpStatus.BAD_REQUEST,
      ),
    );
    expect(mockChainsRepository.getChain).not.toHaveBeenCalled();
    expect(mockPortfolioSnapshotRepository.getSnapshot).not.toHaveBeenCalled();
  });

  it('reads every chain of a wallet from one Zerion snapshot', async () => {
    const address = randomAddress();
    const unmappedNetwork = faker.string.alpha({ length: 12, casing: 'lower' });
    const snapshot = portfolioSnapshotBuilder()
      .with('fiatTotalByNetwork', {
        ethereum: faker.number.float({ min: 1, max: 1_000 }),
        polygon: faker.number.float({ min: 1, max: 1_000 }),
        [unmappedNetwork]: faker.number.float({ min: 1, max: 1_000 }),
      })
      .build();
    mockPortfolioSnapshotRepository.getSnapshot.mockResolvedValue(snapshot);
    const trusted = faker.datatype.boolean();

    const result = await service.getSummaries({
      safes: [
        { chainId: '1', address },
        { chainId: '137', address },
      ],
      currency,
      trusted,
    });

    expect(mockPortfolioSnapshotRepository.getSnapshot).toHaveBeenCalledTimes(
      1,
    );
    expect(mockPortfolioSnapshotRepository.getSnapshot).toHaveBeenCalledWith({
      address,
      isTestnet: false,
      currency,
      trusted,
    });
    const expectedSnapshot = {
      fiatTotal: getNumberString(snapshot.fiatTotal),
      fiatChange1d:
        snapshot.fiatChange1d === null
          ? null
          : getNumberString(snapshot.fiatChange1d),
      percentChange1d: snapshot.percentChange1d,
      // The unmapped network has no chainId, so it is left out.
      fiatTotalByChain: {
        '1': getNumberString(snapshot.fiatTotalByNetwork.ethereum),
        '137': getNumberString(snapshot.fiatTotalByNetwork.polygon),
      },
      fiatTotalByType: Object.fromEntries(
        Object.entries(snapshot.fiatTotalByType).map(([type, value]) => [
          type,
          getNumberString(value),
        ]),
      ),
      updatedAt: snapshot.updatedAt,
      expiresAt: snapshot.expiresAt,
    };
    expect(result).toEqual([
      {
        chainId: '1',
        address,
        fiatTotal: getNumberString(snapshot.fiatTotalByNetwork.ethereum),
        source: 'zerion',
        snapshot: expectedSnapshot,
      },
      {
        chainId: '137',
        address,
        fiatTotal: getNumberString(snapshot.fiatTotalByNetwork.polygon),
        source: 'zerion',
        snapshot: expectedSnapshot,
      },
    ]);
    expect(mockBalancesRepository.getBalances).not.toHaveBeenCalled();
  });

  it('reports 0 for a Zerion chain missing from the distribution', async () => {
    const address = randomAddress();
    mockPortfolioSnapshotRepository.getSnapshot.mockResolvedValue(
      portfolioSnapshotBuilder()
        .with('fiatTotalByNetwork', { ethereum: faker.number.float() })
        .build(),
    );

    const [summary] = await service.getSummaries({
      safes: [{ chainId: '137', address }],
      currency,
      trusted: false,
    });

    expect(summary.fiatTotal).toBe('0');
    expect(summary.source).toBe('zerion');
  });

  it('reads a chain Zerion does not list from the Transaction Service', async () => {
    const address = randomAddress();
    const balances = [
      balanceBuilder().with('fiatBalance', '12.5').build(),
      balanceBuilder().with('fiatBalance', '7.5').build(),
      balanceBuilder().with('fiatBalance', null).build(),
    ];
    mockBalancesRepository.getBalances.mockResolvedValue(balances);
    const trusted = faker.datatype.boolean();

    const result = await service.getSummaries({
      safes: [{ chainId: unsupportedChainId, address }],
      currency,
      trusted,
    });

    expect(result).toEqual([
      {
        chainId: unsupportedChainId,
        address,
        fiatTotal: '20',
        source: 'tx_service',
        snapshot: null,
      },
    ]);
    expect(mockBalancesRepository.getBalances).toHaveBeenCalledWith({
      chain: chainsById[unsupportedChainId],
      safeAddress: address,
      fiatCode: currency,
      trusted,
    });
    expect(mockPortfolioSnapshotRepository.getSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to the Transaction Service when the snapshot is unavailable', async () => {
    const address = randomAddress();
    mockPortfolioSnapshotRepository.getSnapshot.mockRejectedValue(
      new Error('Zerion unavailable'),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', '3').build(),
    ]);

    const result = await service.getSummaries({
      safes: [{ chainId: '1', address }],
      currency,
      trusted: false,
    });

    expect(result).toEqual([
      {
        chainId: '1',
        address,
        fiatTotal: '3',
        source: 'tx_service',
        snapshot: null,
      },
    ]);
  });

  it('leaves out a Safe no source can value, and returns the others', async () => {
    const failing = randomAddress();
    const working = randomAddress();
    mockPortfolioSnapshotRepository.getSnapshot.mockImplementation(
      ({ address }) =>
        address === failing
          ? Promise.reject(new Error('Zerion unavailable'))
          : Promise.resolve(
              portfolioSnapshotBuilder()
                .with('fiatTotalByNetwork', { ethereum: 1 })
                .build(),
            ),
    );
    mockBalancesRepository.getBalances.mockRejectedValue(
      new Error('Transaction Service unavailable'),
    );

    const result = await service.getSummaries({
      safes: [
        { chainId: '1', address: failing },
        { chainId: '1', address: working },
      ],
      currency,
      trusted: false,
    });

    expect(result).toEqual([
      expect.objectContaining({ address: working, fiatTotal: '1' }),
    ]);
  });

  it('never calls Zerion for an address that is not a Safe', async () => {
    const notASafe = randomAddress();
    mockSafeRepository.getSafe.mockRejectedValue(new Error('Not a Safe'));

    const result = await service.getSummaries({
      safes: [{ chainId: '1', address: notASafe }],
      currency,
      trusted: false,
    });

    expect(result).toEqual([]);
    expect(mockPortfolioSnapshotRepository.getSnapshot).not.toHaveBeenCalled();
  });

  it('leaves out a Safe whose chain cannot be resolved', async () => {
    const result = await service.getSummaries({
      safes: [{ chainId: faker.string.numeric(9), address: randomAddress() }],
      currency,
      trusted: false,
    });

    expect(result).toEqual([]);
    expect(mockSafeRepository.getSafe).not.toHaveBeenCalled();
  });

  it('drops repeated Safes and keeps at most the configured number', async () => {
    const repeated = randomAddress();
    const others = Array.from({ length: maxSafes }, randomAddress);
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const result = await service.getSummaries({
      safes: [repeated, repeated, ...others].map((address) => ({
        chainId: unsupportedChainId,
        address,
      })),
      currency,
      trusted: false,
    });

    expect(result.map(({ address }) => address)).toEqual([
      repeated,
      ...others.slice(0, maxSafes - 1),
    ]);
  });

  it('fetches one snapshot per environment of the same address', async () => {
    fakeConfigurationService.set('features.zerionTestnets', true);
    service = buildService();
    const address = randomAddress();
    mockPortfolioSnapshotRepository.getSnapshot.mockResolvedValue(
      portfolioSnapshotBuilder().build(),
    );

    await service.getSummaries({
      safes: [
        { chainId: '1', address },
        { chainId: '11155111', address },
      ],
      currency,
      trusted: false,
    });

    expect(mockPortfolioSnapshotRepository.getSnapshot).toHaveBeenCalledTimes(
      2,
    );
    expect(mockPortfolioSnapshotRepository.getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ address, isTestnet: false }),
    );
    expect(mockPortfolioSnapshotRepository.getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ address, isTestnet: true }),
    );
  });

  it('reads testnets from the Transaction Service while Zerion testnets are disabled', async () => {
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [{ chainId: '11155111', address: randomAddress() }],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(mockPortfolioSnapshotRepository.getSnapshot).not.toHaveBeenCalled();
  });

  it('reads every chain from the Transaction Service while Zerion is disabled', async () => {
    fakeConfigurationService.set('features.zerion', false);
    service = buildService();
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [{ chainId: '1', address: randomAddress() }],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(
      mockZerionRepository.getChainIdToNetworkMapping,
    ).not.toHaveBeenCalled();
    expect(mockPortfolioSnapshotRepository.getSnapshot).not.toHaveBeenCalled();
  });
});
