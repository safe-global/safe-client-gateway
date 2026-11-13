// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { CacheRouter } from '#/datasources/cache/cache.router';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import type { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { appBalanceBuilder } from '#/modules/portfolio/domain/entities/__tests__/app-balance.builder';
import { portfolioBuilder } from '#/modules/portfolio/domain/entities/__tests__/portfolio.builder';
import { tokenBalanceBuilder } from '#/modules/portfolio/domain/entities/__tests__/token-balance.builder';
import type { IPortfolioService as IDomainPortfolioService } from '#/modules/portfolio/domain/portfolio.service.interface';
import { PortfolioRouteMapper } from '#/modules/portfolio/v1/portfolio.mapper';
import { PortfolioApiService } from '#/modules/portfolio/v1/portfolio.service';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

describe('PortfolioApiService', () => {
  let service: PortfolioApiService;
  let mockDomainService: MockedObject<IDomainPortfolioService>;
  let mockChainsRepository: MockedObject<IChainsRepository>;
  let mockSafeRepository: MockedObject<ISafeRepository>;
  let mockCacheService: MockedObject<ICacheService>;
  let portfolioRouteMapper: PortfolioRouteMapper;
  const clearCooldownSeconds = faker.number.int({ min: 10, max: 60 });
  const recentClearSeconds = faker.number.int({ min: 10, max: 60 });

  beforeEach(() => {
    vi.resetAllMocks();

    mockDomainService = {
      getPortfolio: vi.fn(),
      clearZerionCaches: vi.fn(),
    } as MockedObject<IDomainPortfolioService>;

    mockChainsRepository = {
      getChain: vi.fn(),
      getChains: vi.fn(),
      getAllChains: vi.fn(),
      clearChain: vi.fn(),
      getSingletons: vi.fn(),
      getIndexingStatus: vi.fn(),
      isSupportedChain: vi.fn(),
    } as MockedObject<IChainsRepository>;

    mockSafeRepository = {
      getSafe: vi.fn(),
    } as MockedObject<ISafeRepository>;

    mockCacheService = {
      increment: vi.fn(),
      getCounter: vi.fn(),
    } as MockedObject<ICacheService>;

    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'portfolio.clear.cooldownSeconds',
      clearCooldownSeconds,
    );
    configurationService.set(
      'portfolio.clear.recentClearSeconds',
      recentClearSeconds,
    );

    portfolioRouteMapper = new PortfolioRouteMapper();

    service = new PortfolioApiService(
      mockDomainService,
      portfolioRouteMapper,
      mockChainsRepository,
      mockSafeRepository,
      mockCacheService,
      configurationService,
    );
  });

  describe('getPortfolio', () => {
    it('should call domain service and map result', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'USD';
      const domainPortfolio = portfolioBuilder().build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(mockDomainService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds: undefined,
        trusted: undefined,
        excludeDust: undefined,
        isTestnet: false,
      });

      // Verify that result is mapped (not the raw domain portfolio)
      expect(result).not.toBe(domainPortfolio);
      expect(result.totalBalanceFiat).toBe(domainPortfolio.totalBalanceFiat);
      expect(result.tokenBalances).toBeDefined();
      expect(result.positionBalances).toBeDefined();
    });

    it('should map domain portfolio through mapper with correct structure', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'USD';

      const tokenBalance = tokenBalanceBuilder().build();
      const appBalance = appBalanceBuilder().build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [tokenBalance])
        .with('positionBalances', [appBalance])
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      // Verify mapper was used - check that structure matches mapped format
      expect(result.tokenBalances).toHaveLength(1);
      expect(result.positionBalances).toHaveLength(1);
      expect(result.positionBalances[0].appInfo).toBeDefined();
      expect(result.positionBalances[0].groups).toBeDefined();
      expect(Array.isArray(result.positionBalances[0].groups)).toBe(true);
    });

    it('should pass through all parameters with isTestnet=false for mainnet chains', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'EUR';
      const chainIds = ['1', '10'];
      const trusted = true;
      const excludeDust = true;

      const mainnetChain = chainBuilder().with('isTestnet', false).build();
      mockChainsRepository.getChain.mockResolvedValue(mainnetChain);

      const domainPortfolio = portfolioBuilder().build();
      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      await service.getPortfolio({
        address,
        fiatCode,
        chainIds,
        trusted,
        excludeDust,
      });

      expect(mockDomainService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds,
        trusted,
        excludeDust,
        isTestnet: false,
      });
    });

    it('should set isTestnet=true when all chainIds are testnets', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'USD';
      const chainIds = ['11155111']; // Sepolia

      const testnetChain = chainBuilder().with('isTestnet', true).build();
      mockChainsRepository.getChain.mockResolvedValue(testnetChain);

      const domainPortfolio = portfolioBuilder().build();
      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      await service.getPortfolio({
        address,
        fiatCode,
        chainIds,
      });

      expect(mockDomainService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds,
        trusted: undefined,
        excludeDust: undefined,
        isTestnet: true,
      });
    });

    it('should set isTestnet=false when chainIds mix mainnet and testnet', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'USD';
      const chainIds = ['1', '11155111']; // Mainnet and Sepolia

      const mainnetChain = chainBuilder().with('isTestnet', false).build();
      const testnetChain = chainBuilder().with('isTestnet', true).build();
      mockChainsRepository.getChain
        .mockResolvedValueOnce(mainnetChain)
        .mockResolvedValueOnce(testnetChain);

      const domainPortfolio = portfolioBuilder().build();
      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      await service.getPortfolio({
        address,
        fiatCode,
        chainIds,
      });

      expect(mockDomainService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds,
        trusted: undefined,
        excludeDust: undefined,
        isTestnet: false,
      });
    });

    it('should pass sync parameter through to domain service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'USD';
      const sync = true;

      const domainPortfolio = portfolioBuilder().build();
      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      await service.getPortfolio({
        address,
        fiatCode,
        sync,
      });

      expect(mockDomainService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds: undefined,
        trusted: undefined,
        excludeDust: undefined,
        sync,
        isTestnet: false,
      });
    });
  });

  describe('clearZerionCaches', () => {
    it('should clear the caches of a Safe', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('address', address).build(),
      );
      mockCacheService.increment.mockResolvedValue(1);
      mockCacheService.getCounter.mockResolvedValue(null);

      await service.clearZerionCaches({ chainId, address });

      expect(mockSafeRepository.getSafe).toHaveBeenCalledWith({
        chainId,
        address,
      });
      expect(mockCacheService.increment).toHaveBeenCalledWith(
        CacheRouter.getPortfolioClearCooldownCacheKey({ address }),
        clearCooldownSeconds,
        0,
      );
      expect(mockDomainService.clearZerionCaches).toHaveBeenCalledWith({
        address,
      });
    });

    it('should skip a repeat clear within the cooldown', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('address', address).build(),
      );
      mockCacheService.increment.mockResolvedValue(
        faker.number.int({ min: 2, max: 10 }),
      );

      await service.clearZerionCaches({ chainId, address });

      expect(mockCacheService.getCounter).not.toHaveBeenCalled();
      expect(mockDomainService.clearZerionCaches).not.toHaveBeenCalled();
    });

    it('should skip a clear when the caches were cleared within the recent-clear window', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('address', address).build(),
      );
      mockCacheService.increment.mockResolvedValue(1);
      mockCacheService.getCounter.mockResolvedValue(
        Date.now() -
          faker.number.int({ min: 0, max: (recentClearSeconds - 1) * 1_000 }),
      );

      await service.clearZerionCaches({ chainId, address });

      expect(mockCacheService.getCounter).toHaveBeenCalledWith(
        CacheRouter.getPortfolioClearedAtCacheKey({ address }),
      );
      expect(mockDomainService.clearZerionCaches).not.toHaveBeenCalled();
    });

    it('should clear when the last clear is older than the recent-clear window', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('address', address).build(),
      );
      mockCacheService.increment.mockResolvedValue(1);
      mockCacheService.getCounter.mockResolvedValue(
        Date.now() -
          faker.number.int({
            min: (recentClearSeconds + 1) * 1_000,
            max: (recentClearSeconds + 120) * 1_000,
          }),
      );

      await service.clearZerionCaches({ chainId, address });

      expect(mockDomainService.clearZerionCaches).toHaveBeenCalledWith({
        address,
      });
    });

    it('should not clear or count an address that is not a Safe', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const error = new Error('Not found');
      mockSafeRepository.getSafe.mockRejectedValue(error);

      await expect(
        service.clearZerionCaches({ chainId, address }),
      ).rejects.toThrow(error);

      expect(mockCacheService.increment).not.toHaveBeenCalled();
      expect(mockDomainService.clearZerionCaches).not.toHaveBeenCalled();
    });
  });
});
