// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { LimitReachedError } from '#/datasources/network/entities/errors/limit-reached.error';
import { LogType } from '#/domain/common/entities/log-type.entity';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { getNumberString } from '#/domain/common/utils/utils';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IBalancesRepository } from '#/modules/balances/domain/balances.repository.interface';
import { balanceBuilder } from '#/modules/balances/domain/entities/__tests__/balance.builder';
import type { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { portfolioSnapshotBuilder } from '#/modules/portfolio/domain/entities/__tests__/portfolio-snapshot.builder';
import { tokenBalanceBuilder } from '#/modules/portfolio/domain/entities/__tests__/token-balance.builder';
import { tokenInfoBuilder } from '#/modules/portfolio/domain/entities/__tests__/token-info.builder';
import type { PortfolioSnapshot } from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';
import type { IPortfolioRepository } from '#/modules/portfolio/domain/portfolio.repository.interface';
import { PortfolioSummariesV2Service } from '#/modules/portfolio/routes/v2/portfolio-summaries.v2.service';
import { PortfolioSummaryMapper } from '#/modules/portfolio/routes/v2/portfolio-summary.mapper';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { IZerionRepository } from '#/modules/zerion/domain/zerion.repository.interface';

const mockChainsRepository = vi.mocked({
  getChain: vi.fn(),
} as MockedObject<IChainsRepository>);

const mockSafeRepository = vi.mocked({
  getSafe: vi.fn(),
} as MockedObject<ISafeRepository>);

const mockZerionRepository = vi.mocked({
  getChainIdToNetworkMapping: vi.fn(),
} as MockedObject<IZerionRepository>);

const mockPortfolioRepository = vi.mocked({
  getPortfolioSnapshot: vi.fn(),
} as MockedObject<IPortfolioRepository>);

const mockBalancesRepository = vi.mocked({
  getBalances: vi.fn(),
} as MockedObject<IBalancesRepository>);

const mockLoggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
} as MockedObject<ILoggingService>;

const [
  mainnetChainId,
  otherMainnetChainId,
  testnetChainId,
  unsupportedChainId,
] = faker.helpers.uniqueArray(
  () => faker.string.numeric({ length: { min: 1, max: 9 } }),
  4,
);
const networkName = (): string =>
  faker.string.alpha({ length: 12, casing: 'lower' });

// Chains Zerion lists per environment, keyed by chainId; anything else is unsupported.
const zerionNetworks: Record<'mainnet' | 'testnet', Record<string, string>> = {
  mainnet: {
    [mainnetChainId]: networkName(),
    [otherMainnetChainId]: networkName(),
  },
  testnet: { [testnetChainId]: networkName() },
};

const buildChain = (chainId: string, isTestnet = false): Chain =>
  chainBuilder().with('chainId', chainId).with('isTestnet', isTestnet).build();

const snapshotWith = (
  valuesByChain: Record<string, number>,
): PortfolioSnapshot =>
  portfolioSnapshotBuilder()
    .with(
      'tokenBalances',
      Object.entries(valuesByChain).map(([chainId, value]) =>
        tokenBalanceBuilder()
          .with(
            'tokenInfo',
            tokenInfoBuilder().with('chainId', chainId).build(),
          )
          .with('balanceFiat', getNumberString(value))
          .build(),
      ),
    )
    .with('positionBalances', [])
    .build();

const fiat = (): number => faker.number.int({ min: 1, max: 100_000 }) / 100;

const chainsById: Record<string, Chain> = {
  [mainnetChainId]: buildChain(mainnetChainId),
  [otherMainnetChainId]: buildChain(otherMainnetChainId),
  [unsupportedChainId]: buildChain(unsupportedChainId),
  [testnetChainId]: buildChain(testnetChainId, true),
};

describe('PortfolioSummariesV2Service', () => {
  const [currency, otherCurrency, unsupportedCurrency] =
    faker.helpers.uniqueArray(() => faker.finance.currencyCode(), 3);
  const maxSafes = 5;
  let fakeConfigurationService: FakeConfigurationService;
  let service: PortfolioSummariesV2Service;

  const buildService = (): PortfolioSummariesV2Service =>
    new PortfolioSummariesV2Service(
      mockChainsRepository,
      mockSafeRepository,
      mockZerionRepository,
      mockPortfolioRepository,
      mockBalancesRepository,
      new PortfolioSummaryMapper(),
      fakeConfigurationService,
      mockLoggingService,
    );

  beforeEach(() => {
    vi.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('mappings.safe.maxOverviews', maxSafes);
    fakeConfigurationService.set('features.zerion', true);
    fakeConfigurationService.set('features.zerionTestnets', false);
    fakeConfigurationService.set('balances.providers.zerion.currencies', [
      currency,
      otherCurrency,
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
        safes: [
          {
            chainId: mainnetChainId,
            address: getAddress(faker.finance.ethereumAddress()),
          },
        ],
        currency: unsupportedCurrency,
        trusted: false,
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        `Unsupported currency code: ${unsupportedCurrency}`,
        HttpStatus.BAD_REQUEST,
      ),
    );
    expect(mockChainsRepository.getChain).not.toHaveBeenCalled();
    expect(mockPortfolioRepository.getPortfolioSnapshot).not.toHaveBeenCalled();
  });

  it('values every chain of a wallet from one Zerion snapshot', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const [mainnetValue, polygonValue] = [fiat(), fiat()];
    const snapshot = snapshotWith({
      [mainnetChainId]: mainnetValue,
      [otherMainnetChainId]: polygonValue,
    });
    mockPortfolioRepository.getPortfolioSnapshot.mockResolvedValue(snapshot);
    const trusted = faker.datatype.boolean();

    const result = await service.getSummaries({
      safes: [
        { chainId: mainnetChainId, address },
        { chainId: otherMainnetChainId, address },
      ],
      currency,
      trusted,
    });

    expect(mockPortfolioRepository.getPortfolioSnapshot).toHaveBeenCalledTimes(
      1,
    );
    expect(mockPortfolioRepository.getPortfolioSnapshot).toHaveBeenCalledWith({
      address,
      fiatCode: currency,
      trusted,
      isTestnet: false,
    });
    const expectedSnapshot = {
      fiatTotal: getNumberString(mainnetValue + polygonValue),
      fiatTotalByChain: {
        [mainnetChainId]: getNumberString(mainnetValue),
        [otherMainnetChainId]: getNumberString(polygonValue),
      },
      fiatTotalByType: { wallet: getNumberString(mainnetValue + polygonValue) },
      updatedAt: new Date(snapshot.fetchedAt),
      expiresAt: new Date(snapshot.expiresAt),
    };
    expect(result).toEqual([
      {
        chainId: mainnetChainId,
        address,
        fiatTotal: getNumberString(mainnetValue),
        source: 'zerion',
        snapshot: expectedSnapshot,
      },
      {
        chainId: otherMainnetChainId,
        address,
        fiatTotal: getNumberString(polygonValue),
        source: 'zerion',
        snapshot: expectedSnapshot,
      },
    ]);
    expect(mockBalancesRepository.getBalances).not.toHaveBeenCalled();
  });

  it('values a Zerion chain without rows at 0', async () => {
    mockPortfolioRepository.getPortfolioSnapshot.mockResolvedValue(
      snapshotWith({ [mainnetChainId]: fiat() }),
    );

    const [summary] = await service.getSummaries({
      safes: [
        {
          chainId: otherMainnetChainId,
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ],
      currency,
      trusted: false,
    });

    expect(summary.fiatTotal).toBe('0');
    expect(summary.source).toBe('zerion');
  });

  it('reads a chain Zerion does not list from the Transaction Service', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const value = fiat();
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', getNumberString(value)).build(),
    ]);
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
        fiatTotal: getNumberString(value),
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
    expect(mockPortfolioRepository.getPortfolioSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to the Transaction Service when the snapshot is unavailable', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockPortfolioRepository.getPortfolioSnapshot.mockRejectedValue(
      new Error('Zerion unavailable'),
    );
    const value = fiat();
    mockBalancesRepository.getBalances.mockResolvedValue([
      balanceBuilder().with('fiatBalance', getNumberString(value)).build(),
    ]);

    const result = await service.getSummaries({
      safes: [{ chainId: mainnetChainId, address }],
      currency,
      trusted: false,
    });

    expect(result).toEqual([
      {
        chainId: mainnetChainId,
        address,
        fiatTotal: getNumberString(value),
        source: 'tx_service',
        snapshot: null,
      },
    ]);
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LogType.PortfolioDegradedServe,
        safeAddress: address,
        balanceSource: 'balances_repo',
      }),
    );
  });

  it('leaves out a Safe no source can value, and returns the others', async () => {
    const failing = getAddress(faker.finance.ethereumAddress());
    const working = getAddress(faker.finance.ethereumAddress());
    const value = fiat();
    mockPortfolioRepository.getPortfolioSnapshot.mockImplementation(
      ({ address }) =>
        address === failing
          ? Promise.reject(new Error('Zerion unavailable'))
          : Promise.resolve(snapshotWith({ [mainnetChainId]: value })),
    );
    mockBalancesRepository.getBalances.mockRejectedValue(
      new Error('Transaction Service unavailable'),
    );

    const result = await service.getSummaries({
      safes: [
        { chainId: mainnetChainId, address: failing },
        { chainId: mainnetChainId, address: working },
      ],
      currency,
      trusted: false,
    });

    expect(result).toEqual([
      expect.objectContaining({
        address: working,
        fiatTotal: getNumberString(value),
      }),
    ]);
  });

  it('never calls Zerion for an address that is not a Safe', async () => {
    const notASafe = getAddress(faker.finance.ethereumAddress());
    mockSafeRepository.getSafe.mockRejectedValue(new Error('Not a Safe'));

    const result = await service.getSummaries({
      safes: [{ chainId: mainnetChainId, address: notASafe }],
      currency,
      trusted: false,
    });

    expect(result).toEqual([]);
    expect(mockPortfolioRepository.getPortfolioSnapshot).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Safe could not be resolved',
        safeAddress: notASafe,
        chainId: mainnetChainId,
      }),
    );
  });

  it('leaves out a Safe whose chain cannot be resolved', async () => {
    const result = await service.getSummaries({
      safes: [
        {
          chainId: faker.string.numeric(9),
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ],
      currency,
      trusted: false,
    });

    expect(result).toEqual([]);
    expect(mockSafeRepository.getSafe).not.toHaveBeenCalled();
  });

  it('drops repeated Safes and keeps at most the configured number', async () => {
    const repeated = getAddress(faker.finance.ethereumAddress());
    const others = Array.from({ length: maxSafes }, () =>
      getAddress(faker.finance.ethereumAddress()),
    );
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
    const address = getAddress(faker.finance.ethereumAddress());
    mockPortfolioRepository.getPortfolioSnapshot.mockResolvedValue(
      snapshotWith({}),
    );

    await service.getSummaries({
      safes: [
        { chainId: mainnetChainId, address },
        { chainId: testnetChainId, address },
      ],
      currency,
      trusted: false,
    });

    expect(mockPortfolioRepository.getPortfolioSnapshot).toHaveBeenCalledTimes(
      2,
    );
    expect(mockPortfolioRepository.getPortfolioSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ address, isTestnet: false }),
    );
    expect(mockPortfolioRepository.getPortfolioSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ address, isTestnet: true }),
    );
  });

  it('reads testnets from the Transaction Service while Zerion testnets are disabled', async () => {
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [
        {
          chainId: testnetChainId,
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(mockPortfolioRepository.getPortfolioSnapshot).not.toHaveBeenCalled();
  });

  it('reads every chain from the Transaction Service while Zerion is disabled', async () => {
    fakeConfigurationService.set('features.zerion', false);
    service = buildService();
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [
        {
          chainId: mainnetChainId,
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(
      mockZerionRepository.getChainIdToNetworkMapping,
    ).not.toHaveBeenCalled();
    expect(mockPortfolioRepository.getPortfolioSnapshot).not.toHaveBeenCalled();
  });
  it('reads an environment from the Transaction Service when its Zerion chain list fails', async () => {
    mockZerionRepository.getChainIdToNetworkMapping.mockRejectedValue(
      new Error('Zerion unavailable'),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [
        {
          chainId: mainnetChainId,
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(mockBalancesRepository.getBalances).toHaveBeenCalledTimes(1);
    expect(mockPortfolioRepository.getPortfolioSnapshot).not.toHaveBeenCalled();
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.objectContaining({ type: LogType.ZerionChainListError }),
    );
  });

  it('logs an over-budget snapshot at debug and falls back', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockPortfolioRepository.getPortfolioSnapshot.mockRejectedValue(
      new LimitReachedError(),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [{ chainId: mainnetChainId, address }],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LogType.PortfolioRequestError,
        event: 'Portfolio over budget',
        safeAddress: address,
      }),
    );
    expect(mockLoggingService.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: LogType.PortfolioRequestError }),
    );
  });

  it('logs a malformed snapshot as schema drift and falls back', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockPortfolioRepository.getPortfolioSnapshot.mockRejectedValue(
      new ZodError([]),
    );
    mockBalancesRepository.getBalances.mockResolvedValue([]);

    const [summary] = await service.getSummaries({
      safes: [{ chainId: mainnetChainId, address }],
      currency,
      trusted: false,
    });

    expect(summary.source).toBe('tx_service');
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LogType.PortfolioRequestError,
        event: 'Portfolio schema drift',
        safeAddress: address,
      }),
    );
  });
});
