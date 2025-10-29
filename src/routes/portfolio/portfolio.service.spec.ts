import { PortfolioService } from '@/routes/portfolio/portfolio.service';
import type { IPortfolioService as DomainPortfolioService } from '@/domain/portfolio/portfolio.service.interface';
import { portfolioBuilder } from '@/domain/portfolio/entities/__tests__/portfolio.builder';
import { tokenBalanceBuilder } from '@/domain/portfolio/entities/__tests__/token-balance.builder';
import { appBalanceBuilder } from '@/domain/portfolio/entities/__tests__/app-balance.builder';
import { appPositionBuilder } from '@/domain/portfolio/entities/__tests__/app-position.builder';
import { tokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/token-info.builder';
import { appPositionTokenInfoBuilder } from '@/domain/portfolio/entities/__tests__/app-position-token-info.builder';
import type { TokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let mockDomainService: jest.MockedObjectDeep<DomainPortfolioService>;
  let mockChartsRepository: any;

  beforeEach(() => {
    jest.resetAllMocks();

    mockDomainService = {
      getPortfolio: jest.fn(),
      clearPortfolio: jest.fn(),
    } as jest.MockedObjectDeep<DomainPortfolioService>;

    mockChartsRepository = {
      getWalletChart: jest.fn(),
      clearWalletChart: jest.fn(),
    };

    service = new PortfolioService(mockDomainService, mockChartsRepository);
  });

  describe('getPortfolio', () => {
    it('should call domain service and map response', async () => {
      const args = {
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
        chainIds: ['1', '10'],
        trusted: true,
        excludeDust: true,
        provider: 'zerion',
      };

      const domainPortfolio = portfolioBuilder().build();
      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio(args);

      expect(mockDomainService.getPortfolio).toHaveBeenCalledWith(args);
      expect(result).toBeDefined();
      expect(result.totalBalanceFiat).toBe(domainPortfolio.totalBalanceFiat);
      expect(result.totalTokenBalanceFiat).toBe(
        domainPortfolio.totalTokenBalanceFiat,
      );
      expect(result.totalPositionsBalanceFiat).toBe(
        domainPortfolio.totalPositionsBalanceFiat,
      );
    });

    it('should map token balances correctly', async () => {
      const tokenInfo = tokenInfoBuilder()
        .with('address', getAddress(faker.finance.ethereumAddress()))
        .with('decimals', 18)
        .with('symbol', 'TEST')
        .with('name', 'Test Token')
        .with('logoUri', 'https://example.com/logo.png')
        .with('chainId', '1')
        .with('trusted', true)
        .with('type', 'ERC20')
        .build();

      const token = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo)
        .with('balance', '1000000000000000000')
        .with('balanceFiat', 100.5)
        .with('price', 100.5)
        .with('priceChangePercentage1d', 5.2)
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [token])
        .with('positionBalances', [])
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.tokenBalances).toHaveLength(1);
      const mappedToken = result.tokenBalances[0];
      expect(mappedToken.tokenInfo.address).toBe(token.tokenInfo.address);
      expect(mappedToken.tokenInfo.decimals).toBe(18);
      expect(mappedToken.tokenInfo.symbol).toBe('TEST');
      expect(mappedToken.tokenInfo.name).toBe('Test Token');
      expect(mappedToken.tokenInfo.logoUri).toBe(
        'https://example.com/logo.png',
      );
      expect(mappedToken.tokenInfo.chainId).toBe('1');
      expect(mappedToken.tokenInfo.trusted).toBe(true);
      expect(mappedToken.tokenInfo.type).toBe('ERC20');
      expect(mappedToken.balance).toBe('1000000000000000000');
      expect(mappedToken.balanceFiat).toBe(100.5);
      expect(mappedToken.price).toBe(100.5);
      expect(mappedToken.priceChangePercentage1d).toBe(5.2);
    });

    it('should replace null address with NULL_ADDRESS constant', async () => {
      const tokenInfo = tokenInfoBuilder()
        .with('address', null as unknown as `0x${string}`)
        .build();

      const token = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo as unknown as TokenBalance['tokenInfo'])
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [token])
        .with('positionBalances', [])
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.tokenBalances[0].tokenInfo.address).toBe(NULL_ADDRESS);
    });

    it('should map app balances correctly', async () => {
      const positionTokenInfo = appPositionTokenInfoBuilder()
        .with('address', getAddress(faker.finance.ethereumAddress()))
        .build();

      const position = appPositionBuilder()
        .with('key', 'test-position-key')
        .with('type', 'lending')
        .with('name', 'USDC Lending')
        .with('tokenInfo', positionTokenInfo)
        .with('balance', '5000000000')
        .with('balanceFiat', 5000)
        .with('priceChangePercentage1d', -2.5)
        .build();

      const app = appBalanceBuilder()
        .with('appInfo', {
          name: 'Aave',
          logoUrl: 'https://example.com/aave.png',
          url: 'https://aave.com',
        })
        .with('balanceFiat', 5000)
        .with('positions', [position])
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [app])
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.positionBalances).toHaveLength(1);
      const mappedApp = result.positionBalances[0];
      expect(mappedApp.appInfo.name).toBe('Aave');
      expect(mappedApp.appInfo.logoUrl).toBe('https://example.com/aave.png');
      expect(mappedApp.appInfo.url).toBe('https://aave.com');
      expect(mappedApp.balanceFiat).toBe(5000);
      expect(mappedApp.positions).toHaveLength(1);

      const mappedPosition = mappedApp.positions[0];
      expect(mappedPosition.key).toBe('test-position-key');
      expect(mappedPosition.type).toBe('lending');
      expect(mappedPosition.name).toBe('USDC Lending');
      expect(mappedPosition.balance).toBe('5000000000');
      expect(mappedPosition.balanceFiat).toBe(5000);
      expect(mappedPosition.priceChangePercentage1d).toBe(-2.5);
    });

    it('should replace null address in positions with NULL_ADDRESS', async () => {
      const positionTokenInfo = appPositionTokenInfoBuilder()
        .with('address', null as unknown as `0x${string}`)
        .build();

      const position = appPositionBuilder()
        .with('tokenInfo', positionTokenInfo)
        .build();

      const app = appBalanceBuilder().with('positions', [position]).build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [app])
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.positionBalances[0].positions[0].tokenInfo.address).toBe(
        NULL_ADDRESS,
      );
    });

    it('should handle multiple tokens and positions', async () => {
      const tokens = [
        tokenBalanceBuilder().build(),
        tokenBalanceBuilder().build(),
        tokenBalanceBuilder().build(),
      ];

      const apps = [
        appBalanceBuilder()
          .with('positions', [
            appPositionBuilder().build(),
            appPositionBuilder().build(),
          ])
          .build(),
        appBalanceBuilder()
          .with('positions', [appPositionBuilder().build()])
          .build(),
      ];

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', tokens)
        .with('positionBalances', apps)
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.tokenBalances).toHaveLength(3);
      expect(result.positionBalances).toHaveLength(2);
      expect(result.positionBalances[0].positions).toHaveLength(2);
      expect(result.positionBalances[1].positions).toHaveLength(1);
    });

    it('should handle empty portfolio', async () => {
      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [])
        .with('totalBalanceFiat', 0)
        .with('totalTokenBalanceFiat', 0)
        .with('totalPositionsBalanceFiat', 0)
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.tokenBalances).toHaveLength(0);
      expect(result.positionBalances).toHaveLength(0);
      expect(result.totalBalanceFiat).toBe(0);
    });

    it('should handle null and undefined optional fields', async () => {
      const tokenInfo = tokenInfoBuilder().with('logoUri', '').build();

      const token = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo)
        .with('balanceFiat', null)
        .with('price', null)
        .with('priceChangePercentage1d', null)
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [token])
        .with('positionBalances', [])
        .build();

      mockDomainService.getPortfolio.mockResolvedValue(domainPortfolio);

      const result = await service.getPortfolio({
        address: getAddress(faker.finance.ethereumAddress()),
        fiatCode: 'USD',
      });

      expect(result.tokenBalances[0].tokenInfo.logoUri).toBe('');
      expect(result.tokenBalances[0].balanceFiat).toBeNull();
      expect(result.tokenBalances[0].price).toBeNull();
      expect(result.tokenBalances[0].priceChangePercentage1d).toBeNull();
    });
  });

  describe('clearPortfolio', () => {
    it('should call domain service clearPortfolio', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      await service.clearPortfolio({ address });

      expect(mockDomainService.clearPortfolio).toHaveBeenCalledWith({
        address,
      });
      expect(mockDomainService.clearPortfolio).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from domain service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const error = new Error('Cache service error');

      mockDomainService.clearPortfolio.mockRejectedValue(error);

      await expect(service.clearPortfolio({ address })).rejects.toThrow(
        'Cache service error',
      );
    });
  });
});
