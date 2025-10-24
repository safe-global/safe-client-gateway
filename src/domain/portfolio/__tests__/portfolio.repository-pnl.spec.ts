import { PortfolioRepository } from '@/domain/portfolio/portfolio.repository';
import type { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { PnLBuilder } from '@/domain/portfolio/entities/__tests__/pnl.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PortfolioRepository - PnL Caching', () => {
  let repository: PortfolioRepository;
  let mockDefaultApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockZerionApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockZapperApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockCacheService: jest.MockedObjectDeep<ICacheService>;
  let mockConfigService: jest.MockedObjectDeep<IConfigurationService>;

  const positionsCacheTtl = 30;
  const pnlCacheTtl = 60;
  const dustThreshold = 1.0;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDefaultApi = {
      getPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IPortfolioApi>;

    mockZerionApi = {
      getPortfolio: jest.fn(),
      fetchPositions: jest.fn(),
      fetchPnL: jest.fn(),
    } as jest.MockedObjectDeep<IPortfolioApi>;

    mockZapperApi = {
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
        if (key === 'portfolio.cache.positions.ttlSeconds') return positionsCacheTtl;
        if (key === 'portfolio.cache.pnl.ttlSeconds') return pnlCacheTtl;
        if (key === 'portfolio.filters.dustThresholdUsd') return dustThreshold;
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as jest.MockedObjectDeep<IConfigurationService>;

    repository = new PortfolioRepository(
      mockDefaultApi,
      mockZerionApi,
      mockZapperApi,
      mockCacheService,
      mockConfigService,
    );
  });

  describe('Zerion dual-cache strategy', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const fiatCode = 'USD';

    it('should cache positions and PnL separately with different TTLs', async () => {
      const portfolio = portfolioBuilder()
        .with(
          'pnl',
          new PnLBuilder()
            .withRealizedGain(1000)
            .withUnrealizedGain(500)
            .build(),
        )
        .build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      const calls = mockCacheService.hSet.mock.calls;

      // Should have two cache set calls: positions and PnL
      expect(calls.length).toBeGreaterThanOrEqual(2);

      // Find the calls by TTL to verify separate caching
      const positionsCalls = calls.filter(
        (call) => call[2] === positionsCacheTtl,
      );
      const pnlCalls = calls.filter((call) => call[2] === pnlCacheTtl);

      expect(positionsCalls.length).toBeGreaterThan(0);
      expect(pnlCalls.length).toBeGreaterThan(0);
    });

    it('should use positions cache key for positions', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      // Verify getPortfolioPositionsCacheDir was used
      const hSetCalls = mockCacheService.hSet.mock.calls;
      const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      expect(
        hSetCalls.some((call) => {
          return (
            call[0].key === positionsCacheDir.key &&
            call[0].field === positionsCacheDir.field
          );
        }),
      ).toBe(true);
    });

    it('should use PnL cache key for PnL', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      // Verify getPortfolioPnLCacheDir was used
      const hSetCalls = mockCacheService.hSet.mock.calls;
      const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
        address,
        fiatCode,
      });

      expect(
        hSetCalls.some((call) => {
          return (
            call[0].key === pnlCacheDir.key && call[0].field === pnlCacheDir.field
          );
        }),
      ).toBe(true);
    });

    it('should return cached portfolio when both positions and PnL are cached', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });
      const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
        address,
        fiatCode,
      });

      const { pnl, ...positionsOnly } = portfolio;

      mockCacheService.hGet.mockImplementation((dir) => {
        if (
          dir.key === positionsCacheDir.key &&
          dir.field === positionsCacheDir.field
        ) {
          return Promise.resolve(JSON.stringify(positionsOnly));
        }
        if (dir.key === pnlCacheDir.key && dir.field === pnlCacheDir.field) {
          return Promise.resolve(JSON.stringify(pnl));
        }
        return Promise.resolve(undefined);
      });

      const result = await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      expect(result).toEqual(portfolio);
      expect(mockZerionApi.getPortfolio).not.toHaveBeenCalled();
      expect(mockZerionApi.fetchPositions).not.toHaveBeenCalled();
      expect(mockZerionApi.fetchPnL).not.toHaveBeenCalled();
    });

    it('should handle both positions and PnL cached', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });
      const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
        address,
        fiatCode,
      });

      const { pnl, ...positionsOnly } = portfolio;

      mockCacheService.hGet.mockImplementation((dir) => {
        if (
          dir.key === positionsCacheDir.key &&
          dir.field === positionsCacheDir.field
        ) {
          return Promise.resolve(JSON.stringify(positionsOnly));
        }
        if (dir.key === pnlCacheDir.key && dir.field === pnlCacheDir.field) {
          return Promise.resolve(JSON.stringify(pnl));
        }
        return Promise.resolve(undefined);
      });

      const result = await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      expect(mockZerionApi.getPortfolio).not.toHaveBeenCalled();
      expect(result.pnl).toEqual(portfolio.pnl);
    });

    it('should fetch both positions and PnL when neither is cached', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      expect(mockZerionApi.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        trusted: undefined,
        fungibleIds: undefined,
      });
    });

    it('should handle PnL fetch failure when positions are cached', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });
      const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
        address,
        fiatCode,
      });

      const { pnl, ...positionsOnly } = portfolio;
      void pnl;

      mockCacheService.hGet.mockImplementation((dir) => {
        if (
          dir.key === positionsCacheDir.key &&
          dir.field === positionsCacheDir.field
        ) {
          return Promise.resolve(JSON.stringify(positionsOnly));
        }
        if (dir.key === pnlCacheDir.key && dir.field === pnlCacheDir.field) {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      });

      // Simulate PnL fetch failure
      mockZerionApi.fetchPnL = jest
        .fn()
        .mockRejectedValue(new Error('PnL API error'));

      const result = await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      // Should return portfolio without PnL
      expect(result.pnl).toBeNull();
      expect(result.tokenBalances).toHaveLength(portfolio.tokenBalances.length);
      expect(mockZerionApi.fetchPnL).toHaveBeenCalledWith({
        address,
        fiatCode,
        fungibleIds: undefined,
      });
    });

    it('should return portfolio even if positions data structure is strict', async () => {
      const portfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      const result = await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZERION,
      });

      expect(result.pnl).toEqual(portfolio.pnl);
      expect(result.tokenBalances).toHaveLength(portfolio.tokenBalances.length);
    });
  });

  describe('Zapper single-cache strategy (no PnL)', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const fiatCode = 'USD';

    it('should cache entire portfolio including null pnl', async () => {
      const portfolio = portfolioBuilder().with('pnl', null).build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockZapperApi.getPortfolio.mockResolvedValue(rawify(portfolio));

      await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZAPPER,
      });

      expect(mockCacheService.hSet).toHaveBeenCalled();
      const cachedCall = mockCacheService.hSet.mock.calls[0];
      const cachedPortfolio = JSON.parse(cachedCall[1]);

      expect(cachedPortfolio.pnl).toBeNull();
    });

    it('should return cached portfolio for Zapper', async () => {
      const portfolio = portfolioBuilder().with('pnl', null).build();

      mockCacheService.hGet.mockResolvedValue(JSON.stringify(portfolio));

      const result = await repository.getPortfolio({
        address,
        fiatCode,
        provider: PortfolioProvider.ZAPPER,
      });

      expect(result).toEqual(portfolio);
      expect(mockZapperApi.getPortfolio).not.toHaveBeenCalled();
    });
  });

  describe('clearPortfolio with PnL', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    it('should clear positions and PnL caches for Zerion', async () => {
      await repository.clearPortfolio({ address });

      const deleteByKeyCalls = mockCacheService.deleteByKey.mock.calls;

      // Should attempt to delete both positions and PnL cache keys
      expect(deleteByKeyCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
