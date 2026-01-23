import { PortfolioRepository } from '@/modules/portfolio/domain/portfolio.repository';
import type { IPortfolioApi } from '@/modules/portfolio/interfaces/portfolio-api.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { portfolioBuilder } from '@/modules/portfolio/domain/entities/__tests__/portfolio.builder';
import { tokenBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-balance.builder';
import { tokenInfoBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-info.builder';
import { appBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-balance.builder';
import { appPositionBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-position.builder';
import { appPositionGroupBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-position-group.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IPortfolioCacheInfoService } from '@/modules/portfolio/domain/portfolio-cache-info.service';

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository;
  let mockPortfolioApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockCacheService: jest.MockedObjectDeep<ICacheService>;
  let mockConfigService: jest.MockedObjectDeep<IConfigurationService>;
  let mockPortfolioCacheInfoService: jest.MockedObjectDeep<IPortfolioCacheInfoService>;

  const defaultCacheTtl = 30;
  const defaultDustThreshold = 0.001;

  beforeEach(() => {
    jest.resetAllMocks();

    mockPortfolioApi = {
      getPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IPortfolioApi>;

    mockCacheService = {
      hGet: jest.fn(),
      hSet: jest.fn(),
      deleteByKey: jest.fn(),
      getTTL: jest.fn().mockResolvedValue(defaultCacheTtl),
    } as jest.MockedObjectDeep<ICacheService>;

    mockConfigService = {
      get: jest.fn(),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'portfolio.cache.ttlSeconds') return defaultCacheTtl;
        if (key === 'portfolio.filters.dustThresholdUsd')
          return defaultDustThreshold;
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as jest.MockedObjectDeep<IConfigurationService>;

    mockPortfolioCacheInfoService = {
      setCacheInfo: jest.fn(),
      getCacheInfo: jest.fn(),
    } as jest.MockedObjectDeep<IPortfolioCacheInfoService>;

    repository = new PortfolioRepository(
      mockPortfolioApi,
      mockCacheService,
      mockConfigService,
      mockPortfolioCacheInfoService,
    );
  });

  describe('getPortfolio', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const fiatCode = 'USD';

    describe('caching', () => {
      it('should return cached portfolio if available', async () => {
        const cachedPortfolio = portfolioBuilder().build();

        mockCacheService.hGet.mockResolvedValueOnce(
          JSON.stringify(cachedPortfolio),
        );

        const result = await repository.getPortfolio({
          address,
          fiatCode,
        });

        expect(result).toEqual(cachedPortfolio);
        expect(mockPortfolioApi.getPortfolio).not.toHaveBeenCalled();
      });

      it('should fetch and cache portfolio if not cached', async () => {
        const portfolio = portfolioBuilder().build();
        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
        });

        expect(result).toEqual(portfolio);
        expect(mockPortfolioApi.getPortfolio).toHaveBeenCalledWith({
          address,
          fiatCode,
          chainIds: undefined,
          trusted: undefined,
        });

        const cacheDir = CacheRouter.getPortfolioCacheDir({
          address,
          fiatCode,
        });

        expect(mockCacheService.hSet).toHaveBeenCalledWith(
          cacheDir,
          expect.any(String),
          defaultCacheTtl,
        );

        const cachedValue = JSON.parse(mockCacheService.hSet.mock.calls[0][1]);
        expect(cachedValue).toMatchObject(expect.objectContaining(portfolio));
      });

      it('should bypass cache when sync is true', async () => {
        const freshPortfolio = portfolioBuilder().build();
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(freshPortfolio));

        await repository.getPortfolio({
          address,
          fiatCode,
          sync: true,
        });

        expect(mockCacheService.hGet).not.toHaveBeenCalled();
        expect(mockPortfolioApi.getPortfolio).toHaveBeenCalledWith({
          address,
          fiatCode,
          chainIds: undefined,
          trusted: undefined,
          sync: true,
        });
      });
    });

    describe('filtering', () => {
      it('should filter by chain IDs', async () => {
        const chain1TokenInfo = tokenInfoBuilder().with('chainId', '1').build();
        const chain10TokenInfo = tokenInfoBuilder()
          .with('chainId', '10')
          .build();

        const chain1Token = tokenBalanceBuilder()
          .with('tokenInfo', chain1TokenInfo)
          .build();
        const chain10Token = tokenBalanceBuilder()
          .with('tokenInfo', chain10TokenInfo)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [chain1Token, chain10Token])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.tokenBalances).toHaveLength(1);
        expect(result.tokenBalances[0].tokenInfo.chainId).toBe('1');
      });

      it('should filter by trusted tokens', async () => {
        const trustedTokenInfo = tokenInfoBuilder()
          .with('trusted', true)
          .build();
        const untrustedTokenInfo = tokenInfoBuilder()
          .with('trusted', false)
          .build();

        const trustedToken = tokenBalanceBuilder()
          .with('tokenInfo', trustedTokenInfo)
          .build();
        const untrustedToken = tokenBalanceBuilder()
          .with('tokenInfo', untrustedTokenInfo)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [trustedToken, untrustedToken])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          trusted: true,
        });

        expect(result.tokenBalances).toHaveLength(1);
        expect(result.tokenBalances[0].tokenInfo.trusted).toBe(true);
      });

      it('should filter dust positions when excludeDust is true', async () => {
        const largeBalance = tokenBalanceBuilder()
          .with('balanceFiat', '100')
          .build();
        const dustBalance = tokenBalanceBuilder()
          .with('balanceFiat', '0.0005')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [largeBalance, dustBalance])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          excludeDust: true,
        });

        expect(result.tokenBalances).toHaveLength(1);
        expect(result.tokenBalances[0].balanceFiat).toBe('100');
      });

      it('should recalculate totals after filtering', async () => {
        const chain1TokenInfo = tokenInfoBuilder().with('chainId', '1').build();
        const chain10TokenInfo = tokenInfoBuilder()
          .with('chainId', '10')
          .build();

        const chain1Token = tokenBalanceBuilder()
          .with('tokenInfo', chain1TokenInfo)
          .with('balanceFiat', '100')
          .build();
        const chain10Token = tokenBalanceBuilder()
          .with('tokenInfo', chain10TokenInfo)
          .with('balanceFiat', '50')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [chain1Token, chain10Token])
          .with('positionBalances', [])
          .with('totalBalanceFiat', '150')
          .with('totalTokenBalanceFiat', '150')
          .with('totalPositionsBalanceFiat', '0')
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.totalTokenBalanceFiat).toBe('100');
        expect(result.totalPositionsBalanceFiat).toBe('0');
        expect(result.totalBalanceFiat).toBe('100');
      });

      it('should filter position groups by chain IDs', async () => {
        const chain1PositionTokenInfo = tokenInfoBuilder()
          .with('chainId', '1')
          .build();
        const chain10PositionTokenInfo = tokenInfoBuilder()
          .with('chainId', '10')
          .build();

        const chain1Position = appPositionBuilder()
          .with('tokenInfo', {
            ...chain1PositionTokenInfo,
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '100')
          .build();
        const chain10Position = appPositionBuilder()
          .with('tokenInfo', {
            ...chain10PositionTokenInfo,
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '50')
          .build();

        const group1 = appPositionGroupBuilder()
          .with('name', 'Group 1')
          .with('items', [chain1Position, chain10Position])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group1])
          .with('balanceFiat', '150')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .with('totalBalanceFiat', '150')
          .with('totalTokenBalanceFiat', '0')
          .with('totalPositionsBalanceFiat', '150')
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.positionBalances).toHaveLength(1);
        expect(result.positionBalances[0].groups).toHaveLength(1);
        expect(result.positionBalances[0].groups[0].items).toHaveLength(1);
        expect(
          result.positionBalances[0].groups[0].items[0].tokenInfo.chainId,
        ).toBe('1');
        expect(result.positionBalances[0].balanceFiat).toBe('100');
      });

      it('should filter position groups by trusted tokens', async () => {
        const trustedPositionTokenInfo = tokenInfoBuilder()
          .with('trusted', true)
          .build();
        const untrustedPositionTokenInfo = tokenInfoBuilder()
          .with('trusted', false)
          .build();

        const trustedPosition = appPositionBuilder()
          .with('tokenInfo', {
            ...trustedPositionTokenInfo,
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '100')
          .build();
        const untrustedPosition = appPositionBuilder()
          .with('tokenInfo', {
            ...untrustedPositionTokenInfo,
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '50')
          .build();

        const group = appPositionGroupBuilder()
          .with('name', 'Test Group')
          .with('items', [trustedPosition, untrustedPosition])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group])
          .with('balanceFiat', '150')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          trusted: true,
        });

        expect(result.positionBalances).toHaveLength(1);
        expect(result.positionBalances[0].groups).toHaveLength(1);
        expect(result.positionBalances[0].groups[0].items).toHaveLength(1);
        expect(
          result.positionBalances[0].groups[0].items[0].tokenInfo.trusted,
        ).toBe(true);
        expect(result.positionBalances[0].balanceFiat).toBe('100');
      });

      it('should filter dust positions from groups when excludeDust is true', async () => {
        const largePosition = appPositionBuilder()
          .with('balanceFiat', '100')
          .build();
        const dustPosition = appPositionBuilder()
          .with('balanceFiat', '0.0005')
          .build();

        const group = appPositionGroupBuilder()
          .with('name', 'Test Group')
          .with('items', [largePosition, dustPosition])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group])
          .with('balanceFiat', '100.5')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          excludeDust: true,
        });

        expect(result.positionBalances).toHaveLength(1);
        expect(result.positionBalances[0].groups).toHaveLength(1);
        expect(result.positionBalances[0].groups[0].items).toHaveLength(1);
        expect(result.positionBalances[0].groups[0].items[0].balanceFiat).toBe(
          '100',
        );
        expect(result.positionBalances[0].balanceFiat).toBe('100');
      });

      it('should not filter loan positions with negative balances as dust', async () => {
        const depositPosition = appPositionBuilder()
          .with('balanceFiat', '100')
          .build();
        const loanPosition = appPositionBuilder()
          .with('balanceFiat', '-50')
          .build();

        const group = appPositionGroupBuilder()
          .with('name', 'Lending')
          .with('items', [depositPosition, loanPosition])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group])
          .with('balanceFiat', '50')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          excludeDust: true,
        });

        expect(result.positionBalances).toHaveLength(1);
        expect(result.positionBalances[0].groups[0].items).toHaveLength(2);
        expect(result.positionBalances[0].groups[0].items[0].balanceFiat).toBe(
          '100',
        );
        expect(result.positionBalances[0].groups[0].items[1].balanceFiat).toBe(
          '-50',
        );
        expect(result.positionBalances[0].balanceFiat).toBe('50');
      });

      it('should remove empty groups after filtering', async () => {
        const chain1Position = appPositionBuilder()
          .with('tokenInfo', {
            ...tokenInfoBuilder().with('chainId', '1').build(),
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '100')
          .build();
        const chain10Position = appPositionBuilder()
          .with('tokenInfo', {
            ...tokenInfoBuilder().with('chainId', '10').build(),
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '50')
          .build();

        const group1 = appPositionGroupBuilder()
          .with('name', 'Group 1')
          .with('items', [chain1Position])
          .build();
        const group2 = appPositionGroupBuilder()
          .with('name', 'Group 2')
          .with('items', [chain10Position])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group1, group2])
          .with('balanceFiat', '150')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.positionBalances).toHaveLength(1);
        expect(result.positionBalances[0].groups).toHaveLength(1);
        expect(result.positionBalances[0].groups[0].name).toBe('Group 1');
      });

      it('should remove apps when all groups are empty after filtering', async () => {
        const chain10Position = appPositionBuilder()
          .with('tokenInfo', {
            ...tokenInfoBuilder().with('chainId', '10').build(),
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '50')
          .build();

        const group = appPositionGroupBuilder()
          .with('name', 'Group 1')
          .with('items', [chain10Position])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group])
          .with('balanceFiat', '50')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.positionBalances).toHaveLength(0);
        expect(result.totalPositionsBalanceFiat).toBe('0');
      });

      it('should recalculate position totals after filtering groups', async () => {
        const chain1Position1 = appPositionBuilder()
          .with('tokenInfo', {
            ...tokenInfoBuilder().with('chainId', '1').build(),
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '100')
          .build();
        const chain1Position2 = appPositionBuilder()
          .with('tokenInfo', {
            ...tokenInfoBuilder().with('chainId', '1').build(),
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '50')
          .build();
        const chain10Position = appPositionBuilder()
          .with('tokenInfo', {
            ...tokenInfoBuilder().with('chainId', '10').build(),
            type: 'ERC20' as const,
          })
          .with('balanceFiat', '75')
          .build();

        const group1 = appPositionGroupBuilder()
          .with('name', 'Group 1')
          .with('items', [chain1Position1, chain1Position2])
          .build();
        const group2 = appPositionGroupBuilder()
          .with('name', 'Group 2')
          .with('items', [chain10Position])
          .build();

        const appBalance = appBalanceBuilder()
          .with('groups', [group1, group2])
          .with('balanceFiat', '225')
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [appBalance])
          .with('totalBalanceFiat', '225')
          .with('totalTokenBalanceFiat', '0')
          .with('totalPositionsBalanceFiat', '225')
          .build();

        mockCacheService.hGet.mockResolvedValue(null);
        mockPortfolioApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.totalPositionsBalanceFiat).toBe('150');
        expect(result.totalBalanceFiat).toBe('150');
        expect(result.positionBalances[0].balanceFiat).toBe('150');
      });
    });

    describe('clearPortfolio', () => {
      it('should clear cache for given address', async () => {
        await repository.clearPortfolio({ address });

        const cacheKey = CacheRouter.getPortfolioCacheKey({
          address,
        });

        expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(cacheKey);
      });
    });
  });
});
