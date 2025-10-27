import { PortfolioRepository } from '@/domain/portfolio/portfolio.repository';
import type { IPortfolioApi } from '@/domain/interfaces/portfolio-api.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { PnLBuilder } from '@/domain/portfolio/entities/__tests__/pnl.builder';
import { tokenBalanceBuilder } from '@/domain/portfolio/entities/__tests__/token-balance.builder';
import { appBalanceBuilder } from '@/domain/portfolio/entities/__tests__/app-balance.builder';
import { appPositionBuilder } from '@/domain/portfolio/entities/__tests__/app-position.builder';
import { tokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/token-info.builder';
import { appPositionTokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/app-position-token-info.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository;
  let mockDefaultApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockZerionApi: jest.MockedObjectDeep<IPortfolioApi>;
  let mockZapperApi: jest.MockedObjectDeep<IPortfolioApi>;
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
        if (key === 'portfolio.cache.positions.ttlSeconds') return defaultCacheTtl;
        if (key === 'portfolio.cache.pnl.ttlSeconds') return 60;
        if (key === 'portfolio.filters.dustThresholdUsd')
          return defaultDustThreshold;
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

  describe('getPortfolio', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const fiatCode = 'USD';

    describe('caching', () => {
      it('should return cached portfolio if available', async () => {
        const cachedPortfolio = portfolioBuilder()
          .with('pnl', new PnLBuilder().build())
          .build();
        const { pnl, ...positions} = cachedPortfolio;

        mockCacheService.hGet
          .mockResolvedValueOnce(JSON.stringify(positions))
          .mockResolvedValueOnce(JSON.stringify(pnl));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          provider: PortfolioProvider.ZERION,
        });

        expect(result).toEqual(cachedPortfolio);
        expect(mockZerionApi.getPortfolio).not.toHaveBeenCalled();
      });

      it('should fetch from API and cache if not cached', async () => {
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

        expect(result).toEqual(portfolio);
        expect(mockZerionApi.getPortfolio).toHaveBeenCalledWith({
          address,
          fiatCode,
          trusted: undefined,
        });

        expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);

        const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
          address,
          fiatCode,
          provider: PortfolioProvider.ZERION,
        });
        const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
          address,
          fiatCode,
        });

        const hSetCalls = mockCacheService.hSet.mock.calls;
        const positionsCall = hSetCalls.find(
          (call) => call[0].key === positionsCacheDir.key && call[0].field === positionsCacheDir.field,
        );
        const pnlCall = hSetCalls.find(
          (call) => call[0].key === pnlCacheDir.key && call[0].field === pnlCacheDir.field,
        );

        expect(positionsCall).toBeDefined();
        expect(pnlCall).toBeDefined();

        const { pnl, ...positions } = portfolio;
        const cachedPositions = JSON.parse(positionsCall![1]);
        const cachedPnl = JSON.parse(pnlCall![1]);

        expect(cachedPositions).toEqual(positions);
        expect(cachedPnl).toEqual(pnl);
        expect(positionsCall![2]).toBe(defaultCacheTtl);
        expect(pnlCall![2]).toBe(60);
      });

      it('should use configured cache TTL', async () => {
        const customPositionsTtl = 60;
        const customPnlTtl = 120;
        mockConfigService.getOrThrow.mockImplementation((key: string) => {
          if (key === 'portfolio.cache.positions.ttlSeconds') return customPositionsTtl;
          if (key === 'portfolio.cache.pnl.ttlSeconds') return customPnlTtl;
          if (key === 'portfolio.filters.dustThresholdUsd')
            return defaultDustThreshold;
          throw new Error(`Unexpected config key: ${key}`);
        });

        const newRepository = new PortfolioRepository(
          mockDefaultApi,
          mockZerionApi,
          mockZapperApi,
          mockCacheService,
          mockConfigService,
        );

        const portfolio = portfolioBuilder()
          .with('pnl', new PnLBuilder().build())
          .build();
        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        await newRepository.getPortfolio({
          address,
          fiatCode,
          provider: PortfolioProvider.ZERION,
        });

        expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);

        const hSetCalls = mockCacheService.hSet.mock.calls;
        const positionsCacheDir = CacheRouter.getPortfolioPositionsCacheDir({
          address,
          fiatCode,
          provider: PortfolioProvider.ZERION,
        });
        const pnlCacheDir = CacheRouter.getPortfolioPnLCacheDir({
          address,
          fiatCode,
        });

        const positionsCall = hSetCalls.find(
          (call) => call[0].key === positionsCacheDir.key && call[0].field === positionsCacheDir.field,
        );
        const pnlCall = hSetCalls.find(
          (call) => call[0].key === pnlCacheDir.key && call[0].field === pnlCacheDir.field,
        );

        expect(positionsCall![2]).toBe(customPositionsTtl);
        expect(pnlCall![2]).toBe(customPnlTtl);
      });
    });

    describe('provider selection', () => {
      it('should use Zerion API for zerion provider', async () => {
        const portfolio = portfolioBuilder().build();
        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        await repository.getPortfolio({
          address,
          fiatCode,
          provider: PortfolioProvider.ZERION,
        });

        expect(mockZerionApi.getPortfolio).toHaveBeenCalled();
        expect(mockZapperApi.getPortfolio).not.toHaveBeenCalled();
      });

      it('should use Zapper API for zapper provider', async () => {
        const portfolio = portfolioBuilder().build();
        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZapperApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        await repository.getPortfolio({
          address,
          fiatCode,
          provider: PortfolioProvider.ZAPPER,
        });

        expect(mockZapperApi.getPortfolio).toHaveBeenCalled();
        expect(mockZerionApi.getPortfolio).not.toHaveBeenCalled();
      });

      it('should default to Zerion if no provider specified', async () => {
        const portfolio = portfolioBuilder().build();
        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        await repository.getPortfolio({
          address,
          fiatCode,
        });

        expect(mockZerionApi.getPortfolio).toHaveBeenCalled();
      });

      it('should throw error for unknown provider', async () => {
        mockCacheService.hGet.mockResolvedValue(undefined);

        await expect(
          repository.getPortfolio({
            address,
            fiatCode,
            provider: 'unknown' as PortfolioProvider,
          }),
        ).rejects.toThrow('Unknown provider: unknown');
      });
    });

    describe('chain filtering', () => {
      it('should filter by single chain ID', async () => {
        const token1Info = tokenInfoBuilder().with('chainId', '1').build();
        const token1 = tokenBalanceBuilder()
          .with('tokenInfo', token1Info)
          .with('balanceFiat', 100)
          .build();

        const token2Info = tokenInfoBuilder().with('chainId', '10').build();
        const token2 = tokenBalanceBuilder()
          .with('tokenInfo', token2Info)
          .with('balanceFiat', 200)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [token1, token2])
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
        expect(result.totalTokenBalanceFiat).toBe(100);
      });

      it('should filter by multiple chain IDs', async () => {
        const token1Info = tokenInfoBuilder().with('chainId', '1').build();
        const token1 = tokenBalanceBuilder()
          .with('tokenInfo', token1Info)
          .with('balanceFiat', 100)
          .build();

        const token2Info = tokenInfoBuilder().with('chainId', '10').build();
        const token2 = tokenBalanceBuilder()
          .with('tokenInfo', token2Info)
          .with('balanceFiat', 200)
          .build();

        const token3Info = tokenInfoBuilder().with('chainId', '137').build();
        const token3 = tokenBalanceBuilder()
          .with('tokenInfo', token3Info)
          .with('balanceFiat', 300)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [token1, token2, token3])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1', '137'],
        });

        expect(result.tokenBalances).toHaveLength(2);
        expect(result.tokenBalances.map((t) => t.tokenInfo.chainId)).toEqual([
          '1',
          '137',
        ]);
        expect(result.totalTokenBalanceFiat).toBe(400);
      });

      it('should filter positions by chain ID', async () => {
        const position1TokenInfo = appPositionTokenInfoBuilder().with('chainId', '1').build();
        const position1 = appPositionBuilder()
          .with('tokenInfo', position1TokenInfo)
          .with('balanceFiat', 500)
          .build();

        const position2TokenInfo = appPositionTokenInfoBuilder().with('chainId', '10').build();
        const position2 = appPositionBuilder()
          .with('tokenInfo', position2TokenInfo)
          .with('balanceFiat', 600)
          .build();

        const app = appBalanceBuilder()
          .with('positions', [position1, position2])
          .with('balanceFiat', 1100)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [app])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.positionBalances).toHaveLength(1);
        expect(result.positionBalances[0].positions).toHaveLength(1);
        expect(result.positionBalances[0].positions[0].tokenInfo.chainId).toBe(
          '1',
        );
      });

      it('should remove apps with no positions after chain filtering', async () => {
        const position1TokenInfo = appPositionTokenInfoBuilder().with('chainId', '10').build();
        const position1 = appPositionBuilder()
          .with('tokenInfo', position1TokenInfo)
          .build();

        const app = appBalanceBuilder()
          .with('positions', [position1])
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [app])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'], // Filter for chain 1, but position is on chain 10
        });

        expect(result.positionBalances).toHaveLength(0);
      });

      it('should recalculate app balance after filtering positions', async () => {
        const position1TokenInfo = appPositionTokenInfoBuilder().with('chainId', '1').build();
        const position1 = appPositionBuilder()
          .with('tokenInfo', position1TokenInfo)
          .with('balanceFiat', 100)
          .build();

        const position2TokenInfo = appPositionTokenInfoBuilder().with('chainId', '10').build();
        const position2 = appPositionBuilder()
          .with('tokenInfo', position2TokenInfo)
          .with('balanceFiat', 200)
          .build();

        const app = appBalanceBuilder()
          .with('positions', [position1, position2])
          .with('balanceFiat', 300) // Original total
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [app])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        expect(result.positionBalances[0].balanceFiat).toBe(100); // Only position1
      });
    });

    describe('trusted token filtering', () => {
      it('should filter untrusted tokens when trusted=true', async () => {
        const trustedTokenInfo = tokenInfoBuilder().with('trusted', true).build();
        const trustedToken = tokenBalanceBuilder()
          .with('tokenInfo', trustedTokenInfo)
          .with('balanceFiat', 100)
          .build();

        const untrustedTokenInfo = tokenInfoBuilder().with('trusted', false).build();
        const untrustedToken = tokenBalanceBuilder()
          .with('tokenInfo', untrustedTokenInfo)
          .with('balanceFiat', 200)
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
        expect(result.totalTokenBalanceFiat).toBe(100);
      });

      it('should filter untrusted positions when trusted=true', async () => {
        const trustedPositionInfo = appPositionTokenInfoBuilder().with('trusted', true).build();
        const trustedPosition = appPositionBuilder()
          .with('tokenInfo', trustedPositionInfo)
          .with('balanceFiat', 100)
          .build();

        const untrustedPositionInfo = appPositionTokenInfoBuilder().with('trusted', false).build();
        const untrustedPosition = appPositionBuilder()
          .with('tokenInfo', untrustedPositionInfo)
          .with('balanceFiat', 200)
          .build();

        const app = appBalanceBuilder()
          .with('positions', [trustedPosition, untrustedPosition])
          .with('balanceFiat', 300)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [app])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          trusted: true,
        });

        expect(result.positionBalances[0].positions).toHaveLength(1);
        expect(result.positionBalances[0].positions[0].tokenInfo.trusted).toBe(
          true,
        );
        expect(result.positionBalances[0].balanceFiat).toBe(100);
      });

      it('should not filter when trusted=false', async () => {
        const trustedTokenInfo = tokenInfoBuilder().with('trusted', true).build();
        const trustedToken = tokenBalanceBuilder()
          .with('tokenInfo', trustedTokenInfo)
          .build();

        const untrustedTokenInfo = tokenInfoBuilder().with('trusted', false).build();
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
          trusted: false,
        });

        expect(result.tokenBalances).toHaveLength(2);
      });
    });

    describe('dust filtering', () => {
      it('should filter tokens below dust threshold when excludeDust=true', async () => {
        const largeToken = tokenBalanceBuilder()
          .with('balanceFiat', 10.0)
          .build();
        const dustToken = tokenBalanceBuilder().with('balanceFiat', 0.5).build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [largeToken, dustToken])
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
        expect(result.tokenBalances[0].balanceFiat).toBe(10.0);
      });

      it('should filter positions below dust threshold', async () => {
        const largePosition = appPositionBuilder()
          .with('balanceFiat', 10.0)
          .build();
        const dustPosition = appPositionBuilder()
          .with('balanceFiat', 0.5)
          .build();

        const app = appBalanceBuilder()
          .with('positions', [largePosition, dustPosition])
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [])
          .with('positionBalances', [app])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          excludeDust: true,
        });

        expect(result.positionBalances[0].positions).toHaveLength(1);
        expect(result.positionBalances[0].positions[0].balanceFiat).toBe(10.0);
      });

      it('should use configured dust threshold', async () => {
        const customThreshold = 5.0;
        mockConfigService.getOrThrow.mockImplementation((key: string) => {
          if (key === 'portfolio.cache.positions.ttlSeconds') return defaultCacheTtl;
          if (key === 'portfolio.cache.pnl.ttlSeconds') return 60;
          if (key === 'portfolio.filters.dustThresholdUsd')
            return customThreshold;
          throw new Error(`Unexpected config key: ${key}`);
        });

        const newRepository = new PortfolioRepository(
          mockDefaultApi,
          mockZerionApi,
          mockZapperApi,
          mockCacheService,
          mockConfigService,
        );

        const token1 = tokenBalanceBuilder().with('balanceFiat', 6.0).build();
        const token2 = tokenBalanceBuilder().with('balanceFiat', 4.0).build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [token1, token2])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await newRepository.getPortfolio({
          address,
          fiatCode,
          excludeDust: true,
        });

        expect(result.tokenBalances).toHaveLength(1);
        expect(result.tokenBalances[0].balanceFiat).toBe(6.0);
      });

      it('should treat null balance as dust-free (keep it)', async () => {
        const tokenWithNullBalance = tokenBalanceBuilder()
          .with('balanceFiat', null)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [tokenWithNullBalance])
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
      });

      it('should keep tokens at exact threshold', async () => {
        const tokenAtThreshold = tokenBalanceBuilder()
          .with('balanceFiat', 1.0)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [tokenAtThreshold])
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
      });
    });

    describe('combined filtering', () => {
      it('should apply all filters in order: chains, trusted, dust', async () => {
        // Token that passes all filters
        const validTokenInfo = tokenInfoBuilder()
          .with('chainId', '1')
          .with('trusted', true)
          .build();
        const validToken = tokenBalanceBuilder()
          .with('tokenInfo', validTokenInfo)
          .with('balanceFiat', 10.0)
          .build();

        // Token on wrong chain
        const wrongChainTokenInfo = tokenInfoBuilder()
          .with('chainId', '10')
          .with('trusted', true)
          .build();
        const wrongChainToken = tokenBalanceBuilder()
          .with('tokenInfo', wrongChainTokenInfo)
          .with('balanceFiat', 10.0)
          .build();

        // Untrusted token
        const untrustedTokenInfo = tokenInfoBuilder()
          .with('chainId', '1')
          .with('trusted', false)
          .build();
        const untrustedToken = tokenBalanceBuilder()
          .with('tokenInfo', untrustedTokenInfo)
          .with('balanceFiat', 10.0)
          .build();

        // Dust token
        const dustTokenInfo = tokenInfoBuilder()
          .with('chainId', '1')
          .with('trusted', true)
          .build();
        const dustToken = tokenBalanceBuilder()
          .with('tokenInfo', dustTokenInfo)
          .with('balanceFiat', 0.5)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [
            validToken,
            wrongChainToken,
            untrustedToken,
            dustToken,
          ])
          .with('positionBalances', [])
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
          trusted: true,
          excludeDust: true,
        });

        expect(result.tokenBalances).toHaveLength(1);
        expect(result.tokenBalances[0]).toEqual(validToken);
        expect(result.totalTokenBalanceFiat).toBe(10.0);
      });

      it('should recalculate all totals correctly after filtering', async () => {
        const token1Info = tokenInfoBuilder()
          .with('chainId', '1')
          .with('trusted', true)
          .build();
        const token1 = tokenBalanceBuilder()
          .with('tokenInfo', token1Info)
          .with('balanceFiat', 100)
          .build();

        const token2Info = tokenInfoBuilder()
          .with('chainId', '10')
          .with('trusted', true)
          .build();
        const token2 = tokenBalanceBuilder()
          .with('tokenInfo', token2Info)
          .with('balanceFiat', 200)
          .build();

        const position1Info = appPositionTokenInfoBuilder()
          .with('chainId', '1')
          .with('trusted', true)
          .build();
        const position1 = appPositionBuilder()
          .with('tokenInfo', position1Info)
          .with('balanceFiat', 300)
          .build();

        const position2Info = appPositionTokenInfoBuilder()
          .with('chainId', '10')
          .with('trusted', true)
          .build();
        const position2 = appPositionBuilder()
          .with('tokenInfo', position2Info)
          .with('balanceFiat', 400)
          .build();

        const app = appBalanceBuilder()
          .with('positions', [position1, position2])
          .with('balanceFiat', 700)
          .build();

        const portfolio = portfolioBuilder()
          .with('tokenBalances', [token1, token2])
          .with('positionBalances', [app])
          .with('totalTokenBalanceFiat', 300)
          .with('totalPositionsBalanceFiat', 700)
          .with('totalBalanceFiat', 1000)
          .build();

        mockCacheService.hGet.mockResolvedValue(undefined);
        mockZerionApi.getPortfolio.mockResolvedValue(rawify(portfolio));

        const result = await repository.getPortfolio({
          address,
          fiatCode,
          chainIds: ['1'],
        });

        // Should only have chain 1 tokens/positions
        expect(result.totalTokenBalanceFiat).toBe(100);
        expect(result.totalPositionsBalanceFiat).toBe(300);
        expect(result.totalBalanceFiat).toBe(400);
      });
    });
  });

  describe('clearPortfolio', () => {
    it('should delete cache for both providers', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await repository.clearPortfolio({ address });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(4);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getPortfolioCacheKey({
          address,
          provider: PortfolioProvider.ZERION,
        }),
      );
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getPortfolioPositionsCacheKey({
          address,
          provider: PortfolioProvider.ZERION,
        }),
      );
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getPortfolioPnLCacheKey({
          address,
        }),
      );
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getPortfolioCacheKey({
          address,
          provider: PortfolioProvider.ZAPPER,
        }),
      );
    });

    it('should delete all cache entries', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await repository.clearPortfolio({ address });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(4);
    });
  });
});
