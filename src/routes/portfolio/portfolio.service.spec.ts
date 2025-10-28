import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import type { IPortfolioService as IDomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockDomainService: jest.MockedObjectDeep<IDomainPortfolioService>;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDomainService = {
      getPortfolio: jest.fn(),
      clearPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IDomainPortfolioService>;

    service = new PortfolioService(mockDomainService);
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

      expect(result).toEqual(domainPortfolio);
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
