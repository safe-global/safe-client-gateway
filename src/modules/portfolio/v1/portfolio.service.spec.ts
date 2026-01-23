import { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import type { IPortfolioService as IDomainPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { portfolioBuilder } from '@/modules/portfolio/domain/entities/__tests__/portfolio.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';
import { appBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-balance.builder';
import { tokenBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-balance.builder';

describe('PortfolioApiService', () => {
  let service: PortfolioApiService;
  let mockDomainService: jest.MockedObjectDeep<IDomainPortfolioService>;
  let mockChainsRepository: jest.MockedObjectDeep<IChainsRepository>;
  let portfolioRouteMapper: PortfolioRouteMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDomainService = {
      getPortfolio: jest.fn(),
      clearPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IDomainPortfolioService>;

    mockChainsRepository = {
      getChain: jest.fn(),
      getChains: jest.fn(),
      getAllChains: jest.fn(),
      clearChain: jest.fn(),
      getSingletons: jest.fn(),
      getIndexingStatus: jest.fn(),
      isSupportedChain: jest.fn(),
    } as jest.MockedObjectDeep<IChainsRepository>;

    portfolioRouteMapper = new PortfolioRouteMapper();

    service = new PortfolioApiService(
      mockDomainService,
      portfolioRouteMapper,
      mockChainsRepository,
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

  describe('clearPortfolio', () => {
    it('should call domain service clearPortfolio', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await service.clearPortfolio({ address });

      expect(mockDomainService.clearPortfolio).toHaveBeenCalledWith({
        address,
      });
    });
  });
});
