import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import type { IPortfolioService as IDomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { PnLBuilder } from '@/domain/portfolio/entities/__tests__/pnl.builder';
import { PnL } from '@/routes/portfolio/entities/pnl.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PortfolioService - PnL Mapping', () => {
  let service: PortfolioService;
  let mockDomainPortfolioService: jest.MockedObjectDeep<IDomainPortfolioService>;
  let mockChartsRepository: any;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDomainPortfolioService = {
      getPortfolio: jest.fn(),
      clearPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<IDomainPortfolioService>;

    mockChartsRepository = {
      getWalletChart: jest.fn(),
      clearWalletChart: jest.fn(),
    };

    service = new PortfolioService(
      mockDomainPortfolioService,
      mockChartsRepository,
    );
  });

  describe('getPortfolio', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const fiatCode = 'USD';

    it('should map PnL from domain to API entity', async () => {
      const pnlBuilder = new PnLBuilder()
        .withRealizedGain(1000)
        .withUnrealizedGain(500)
        .withTotalFee(25.5)
        .withNetInvested(5000)
        .withReceivedExternal(2000)
        .withSentExternal(1000)
        .withSentForNfts(100)
        .withReceivedForNfts(50);

      const domainPortfolio = portfolioBuilder()
        .with('pnl', pnlBuilder.build())
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(result.pnl).toBeDefined();
      expect(result.pnl).not.toBeNull();
      expect(result.pnl).toBeInstanceOf(PnL);
      expect(result.pnl?.realizedGain).toBe(1000);
      expect(result.pnl?.unrealizedGain).toBe(500);
      expect(result.pnl?.totalFee).toBe(25.5);
      expect(result.pnl?.netInvested).toBe(5000);
      expect(result.pnl?.receivedExternal).toBe(2000);
      expect(result.pnl?.sentExternal).toBe(1000);
      expect(result.pnl?.sentForNfts).toBe(100);
      expect(result.pnl?.receivedForNfts).toBe(50);
    });

    it('should map null PnL as null', async () => {
      const domainPortfolio = portfolioBuilder()
        .with('pnl', null)
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(result.pnl).toBeNull();
    });

    it('should handle custom PnL values', async () => {
      const customPnL = new PnLBuilder()
        .withRealizedGain(5000)
        .withUnrealizedGain(2000)
        .withTotalFee(100)
        .withNetInvested(10000)
        .withReceivedExternal(3000)
        .withSentExternal(2000)
        .withSentForNfts(500)
        .withReceivedForNfts(250)
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('pnl', customPnL)
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(result.pnl?.realizedGain).toBe(5000);
      expect(result.pnl?.unrealizedGain).toBe(2000);
      expect(result.pnl?.totalFee).toBe(100);
      expect(result.pnl?.netInvested).toBe(10000);
      expect(result.pnl?.receivedExternal).toBe(3000);
      expect(result.pnl?.sentExternal).toBe(2000);
      expect(result.pnl?.sentForNfts).toBe(500);
      expect(result.pnl?.receivedForNfts).toBe(250);
    });

    it('should handle zero PnL values', async () => {
      const zeroPnL = new PnLBuilder()
        .withRealizedGain(0)
        .withUnrealizedGain(0)
        .withTotalFee(0)
        .withNetInvested(0)
        .withReceivedExternal(0)
        .withSentExternal(0)
        .withSentForNfts(0)
        .withReceivedForNfts(0)
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('pnl', zeroPnL)
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(result.pnl?.realizedGain).toBe(0);
      expect(result.pnl?.unrealizedGain).toBe(0);
      expect(result.pnl?.totalFee).toBe(0);
    });

    it('should handle negative PnL values', async () => {
      const negativePnL = new PnLBuilder()
        .withRealizedGain(-1000)
        .withUnrealizedGain(-500)
        .withTotalFee(-25.5)
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('pnl', negativePnL)
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(result.pnl?.realizedGain).toBe(-1000);
      expect(result.pnl?.unrealizedGain).toBe(-500);
      expect(result.pnl?.totalFee).toBe(-25.5);
    });

    it('should map PnL with other portfolio data intact', async () => {
      const domainPortfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
      });

      // Verify other portfolio fields are preserved
      expect(result.totalBalanceFiat).toBe(
        domainPortfolio.totalBalanceFiat,
      );
      expect(result.totalTokenBalanceFiat).toBe(
        domainPortfolio.totalTokenBalanceFiat,
      );
      expect(result.totalPositionsBalanceFiat).toBe(
        domainPortfolio.totalPositionsBalanceFiat,
      );
      expect(result.tokenBalances).toEqual(
        expect.any(Array),
      );
      expect(result.positionBalances).toEqual(
        expect.any(Array),
      );
      expect(result.pnl).toBeDefined();
    });

    it('should support all portfolio query parameters with PnL', async () => {
      const domainPortfolio = portfolioBuilder()
        .with('pnl', new PnLBuilder().build())
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result = await service.getPortfolio({
        address,
        fiatCode,
        chainIds: ['1', '137'],
        trusted: true,
        excludeDust: true,
        provider: 'zerion',
      });

      expect(mockDomainPortfolioService.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode,
        chainIds: ['1', '137'],
        trusted: true,
        excludeDust: true,
        provider: 'zerion',
      });

      expect(result.pnl).toBeDefined();
    });

    it('should create new PnL instance for each call', async () => {
      const pnlData = new PnLBuilder().build();
      const domainPortfolio = portfolioBuilder()
        .with('pnl', pnlData)
        .build();

      mockDomainPortfolioService.getPortfolio.mockResolvedValue(
        domainPortfolio,
      );

      const result1 = await service.getPortfolio({
        address,
        fiatCode,
      });
      const result2 = await service.getPortfolio({
        address,
        fiatCode,
      });

      expect(result1.pnl).not.toBe(result2.pnl);
      expect(result1.pnl).toEqual(result2.pnl);
    });
  });
});
