import { PortfolioRepository } from '@/domain/portfolio/portfolio.repository';
import type { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { tokenBalanceBuilder } from '@/domain/portfolio/entities/__tests__/token-balance.builder';
import { tokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/token-info.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository;
  let mockDefaultApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockZerionApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockCacheService: jest.MockedObjectDeep<ICacheService>;
  let mockConfigService: jest.MockedObjectDeep<IConfigurationService>;

  const defaultCacheTtl = 30;
  const defaultDustThreshold = 1.0;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDefaultApi = {
      getPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IPortfolioApi>;

    mockZerionApi = {
      getPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IPortfolioApi>;

    mockCacheService = {
      hGet: jest.fn(),
      hSet: jest.fn(),
      deleteByKey: jest.fn(),
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

    repository = new PortfolioRepository(
      mockDefaultApi,
      mockZerionApi,
      mockCacheService,
      mockConfigService,
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
          provider: PortfolioProvider.ZERION,
        });

        expect(result).toEqual(cachedPortfolio);
        expect(mockZerionApi.getPortfolio).not.toHaveBeenCalled();
      });

      it('should fetch and cache portfolio if not cached', async () => {
        const portfolio = portfolioBuilder().build();
        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
        });

        expect(result).toEqual(portfolio);
        expect(mockZerionApi.getPortfolio).toHaveBeenCalledWith({
          address,
          fiatCode,
          chainIds: undefined,
          trusted: undefined,
        });

        const cacheDir = CacheRouter.getPortfolioCacheDir({
          address,
          fiatCode,
          provider: 'zerion',
        });

        expect(mockCacheService.hSet).toHaveBeenCalledWith(
          cacheDir,
          expect.any(String),
          defaultCacheTtl,
        );

        const cachedValue = JSON.parse(mockCacheService.hSet.mock.calls[0][1]);
        expect(cachedValue).toMatchObject(portfolio);
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

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

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

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

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
          .with('balanceFiat', 100)
          .build();
        const dustBalance = tokenBalanceBuilder()
          .with('balanceFiat', 0.5)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [largeBalance, dustBalance])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          excludeDust: true,
        });

        expect(result.tokenBalances).toHaveLength(1);
        expect(result.tokenBalances[0].balanceFiat).toBe(100);
      });

      it('should recalculate totals after filtering', async () => {
        const chain1TokenInfo = tokenInfoBuilder().with('chainId', '1').build();
        const chain10TokenInfo = tokenInfoBuilder()
          .with('chainId', '10')
          .build();

        const chain1Token = tokenBalanceBuilder()
          .with('tokenInfo', chain1TokenInfo)
          .with('balanceFiat', 100)
          .build();
        const chain10Token = tokenBalanceBuilder()
          .with('tokenInfo', chain10TokenInfo)
          .with('balanceFiat', 50)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [chain1Token, chain10Token])
          .with('positionBalances', [])
          .with('totalBalanceFiat', 150)
          .with('totalTokenBalanceFiat', 150)
          .with('totalPositionsBalanceFiat', 0)
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.totalTokenBalanceFiat).toBe(100);
        expect(result.totalPositionsBalanceFiat).toBe(0);
        expect(result.totalBalanceFiat).toBe(100);
      });
    });

    describe('clearPortfolio', () => {
      it('should clear cache for given address', async () => {
        await repository.clearPortfolio({ address });

        const cacheKey = CacheRouter.getPortfolioCacheKey({
          address,
          provider: 'zerion',
        });

        expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(cacheKey);
      });
    });
  });
});
