import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { ZerionBalance } from '@/modules/balances/datasources/entities/zerion-balance.entity';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionPositionsApi } from '@/modules/positions/datasources/zerion-positions-api.service';
import { faker } from '@faker-js/faker';
import { getAddress, type Address } from 'viem';

const loggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const networkService = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

function buildZerionLoanBalance(args: { chainName: string; value: number }) {
  return {
    type: 'positions',
    id: faker.string.uuid(),
    attributes: {
      name: faker.word.sample(),
      quantity: {
        int: '1',
        decimals: 18,
        float: 1,
        numeric: '1',
      },
      value: args.value,
      price: 1,
      fungible_info: {
        implementations: [
          {
            chain_id: args.chainName,
            address: null,
            decimals: 18,
          },
        ],
      },
      flags: {
        displayable: true,
      },
      protocol: faker.word.sample(),
      application_metadata: null,
      changes: null,
      position_type: 'loan',
      pool_address: null,
      group_id: null,
    },
  } satisfies ZerionBalance;
}

describe('ZerionPositionsApi', () => {
  let cacheService: FakeCacheService;
  let configurationService: FakeConfigurationService;
  let target: ZerionPositionsApi;

  const chainName = 'ethereum';
  const chain = {
    chainId: '1',
    isTestnet: false,
    balancesProvider: { chainName },
  } as Chain;

  beforeEach(() => {
    jest.resetAllMocks();
    cacheService = new FakeCacheService();
    configurationService = new FakeConfigurationService();
    configurationService.set('balances.providers.zerion.apiKey', 'test-api-key');
    configurationService.set('balances.providers.zerion.baseUri', 'https://api');
    configurationService.set('expirationTimeInSeconds.zerionPositions', 60);
    configurationService.set('balances.providers.zerion.currencies', ['USD']);
    configurationService.set('balances.providers.zerion.chains', {
      1: { chainName },
    });

    target = new ZerionPositionsApi(
      cacheService,
      loggingService,
      networkService,
      configurationService as unknown as IConfigurationService,
      new HttpErrorFactory(),
    );
  });

  it('does not normalize cached balances a second time', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress()) as Address;
    const cachedBalances = [
      buildZerionLoanBalance({ chainName, value: -100 }),
    ];
    const cacheDir = CacheRouter.getZerionPositionsCacheDir({
      safeAddress,
      fiatCode: 'USD',
      refresh: undefined,
    });
    await cacheService.hSet(cacheDir, JSON.stringify(cachedBalances), 60);
    networkService.get.mockRejectedValueOnce(
      new Error('Unexpected request on cache hit'),
    );

    const res = (await target.getPositions({
      chain,
      safeAddress,
      fiatCode: 'USD',
    })) as unknown as Array<{ fiatBalance: string | null; position_type: string }>;

    expect(networkService.get).toHaveBeenCalledTimes(0);
    expect(res).toHaveLength(1);
    expect(res[0].position_type).toBe('loan');
    expect(res[0].fiatBalance).toBe('-100');
  });

  it('normalizes on cache miss and persists the normalized value for cache hits', async () => {
    const safeAddress = getAddress(faker.finance.ethereumAddress()) as Address;
    const apiBalances = [buildZerionLoanBalance({ chainName, value: 100 })];
    networkService.get.mockResolvedValueOnce({
      status: 200,
      data: { data: apiBalances },
    });

    const first = (await target.getPositions({
      chain,
      safeAddress,
      fiatCode: 'USD',
    })) as unknown as Array<{ fiatBalance: string | null; position_type: string }>;

    expect(first).toHaveLength(1);
    expect(first[0].position_type).toBe('loan');
    expect(first[0].fiatBalance).toBe('-100');

    const cacheDir = CacheRouter.getZerionPositionsCacheDir({
      safeAddress,
      fiatCode: 'USD',
      refresh: undefined,
    });
    const cached = await cacheService.hGet(cacheDir);
    expect(cached).toBeDefined();
    const cachedParsed = JSON.parse(cached as string) as Array<ZerionBalance>;
    expect(cachedParsed[0].attributes.value).toBe(-100);

    const second = (await target.getPositions({
      chain,
      safeAddress,
      fiatCode: 'USD',
    })) as unknown as Array<{ fiatBalance: string | null; position_type: string }>;

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(second).toHaveLength(1);
    expect(second[0].position_type).toBe('loan');
    expect(second[0].fiatBalance).toBe('-100');
  });
});

