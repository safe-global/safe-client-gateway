import { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import type { IPortfolioService as IDomainPortfolioService } from '@/modules/portfolio/domain/portfolio.service.interface';
import { portfolioBuilder } from '@/modules/portfolio/domain/entities/__tests__/portfolio.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';
import { appBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-balance.builder';
import { tokenBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-balance.builder';

describe('PortfolioApiService', () => {
  let service: PortfolioApiService;
  let mockDomainService: jest.MockedObjectDeep<IDomainPortfolioService>;
  let portfolioRouteMapper: PortfolioRouteMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDomainService = {
      getPortfolio: jest.fn(),
      clearPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IDomainPortfolioService>;

    portfolioRouteMapper = new PortfolioRouteMapper();

    service = new PortfolioApiService(mockDomainService, portfolioRouteMapper);
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

    it('should pass through all parameters', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = 'EUR';
      const chainIds = ['1', '10'];
      const trusted = true;
      const excludeDust = true;

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
