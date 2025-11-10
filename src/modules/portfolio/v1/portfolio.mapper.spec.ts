import { PortfolioRouteMapper } from '@/modules/portfolio/v1/portfolio.mapper';
import { portfolioBuilder } from '@/modules/portfolio/domain/entities/__tests__/portfolio.builder';
import { tokenBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-balance.builder';
import { appBalanceBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-balance.builder';
import { appPositionBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-position.builder';
import { appPositionGroupBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-position-group.builder';
import { tokenInfoBuilder } from '@/modules/portfolio/domain/entities/__tests__/token-info.builder';
import { getAddress } from 'viem';
import { NULL_ADDRESS } from '@/routes/common/constants';

describe('PortfolioRouteMapper', () => {
  let mapper: PortfolioRouteMapper;

  beforeEach(() => {
    mapper = new PortfolioRouteMapper();
  });

  describe('mapDomainToRoute', () => {
    it('should map domain portfolio to API portfolio', () => {
      const domainPortfolio = portfolioBuilder().build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(result.totalBalanceFiat).toBe(domainPortfolio.totalBalanceFiat);
      expect(result.totalTokenBalanceFiat).toBe(
        domainPortfolio.totalTokenBalanceFiat,
      );
      expect(result.totalPositionsBalanceFiat).toBe(
        domainPortfolio.totalPositionsBalanceFiat,
      );
      expect(result.tokenBalances).toHaveLength(
        domainPortfolio.tokenBalances.length,
      );
      expect(result.positionBalances).toHaveLength(
        domainPortfolio.positionBalances.length,
      );
    });

    it('should map token balances correctly', () => {
      const tokenInfo = tokenInfoBuilder()
        .with(
          'address',
          getAddress('0x1234567890123456789012345678901234567890'),
        )
        .with('chainId', '1')
        .with('type', 'ERC20' as const)
        .build();

      const tokenBalance = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo)
        .with('balance', '1000000000000000000')
        .with('balanceFiat', '1000.50')
        .with('price', '1000.50')
        .with('priceChangePercentage1d', '2.5')
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [tokenBalance])
        .with('positionBalances', [])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(result.tokenBalances).toHaveLength(1);
      expect(result.tokenBalances[0].tokenInfo.address).toBe(
        tokenBalance.tokenInfo.address,
      );
      expect(result.tokenBalances[0].tokenInfo.chainId).toBe('1');
      expect(result.tokenBalances[0].tokenInfo.type).toBe('ERC20');
      expect(result.tokenBalances[0].balance).toBe('1000000000000000000');
      expect(result.tokenBalances[0].balanceFiat).toBe('1000.50');
      expect(result.tokenBalances[0].price).toBe('1000.50');
      expect(result.tokenBalances[0].priceChangePercentage1d).toBe('2.5');
    });

    it('should map null address to NULL_ADDRESS for token balances', () => {
      const tokenInfo = tokenInfoBuilder()
        .with('address', null)
        .with('type', 'NATIVE_TOKEN' as const)
        .build();

      const tokenBalance = tokenBalanceBuilder()
        .with('tokenInfo', tokenInfo)
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [tokenBalance])
        .with('positionBalances', [])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(result.tokenBalances[0].tokenInfo.address).toBe(NULL_ADDRESS);
      expect(result.tokenBalances[0].tokenInfo.type).toBe('NATIVE_TOKEN');
    });

    it('should map app balances with groups correctly', () => {
      const position1 = appPositionBuilder()
        .with('key', 'position-1')
        .with('name', 'Group 1 Position')
        .build();

      const position2 = appPositionBuilder()
        .with('key', 'position-2')
        .with('name', 'Group 1 Position')
        .build();

      const position3 = appPositionBuilder()
        .with('key', 'position-3')
        .with('name', 'Group 2 Position')
        .build();

      const group1 = appPositionGroupBuilder()
        .with('name', 'Group 1')
        .with('items', [position1, position2])
        .build();

      const group2 = appPositionGroupBuilder()
        .with('name', 'Group 2')
        .with('items', [position3])
        .build();

      const appBalance = appBalanceBuilder()
        .with('groups', [group1, group2])
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [appBalance])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(result.positionBalances).toHaveLength(1);
      expect(result.positionBalances[0].groups).toHaveLength(2);
      expect(result.positionBalances[0].groups[0].name).toBe('Group 1');
      expect(result.positionBalances[0].groups[0].items).toHaveLength(2);
      expect(result.positionBalances[0].groups[1].name).toBe('Group 2');
      expect(result.positionBalances[0].groups[1].items).toHaveLength(1);
    });

    it('should map app positions correctly', () => {
      const tokenInfo = tokenInfoBuilder()
        .with(
          'address',
          getAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
        )
        .with('chainId', '137')
        .with('type', 'ERC20' as const)
        .with('trusted', true)
        .build();

      const position = appPositionBuilder()
        .with('key', 'pos-key-123')
        .with('type', 'staking')
        .with('name', 'Staked Position')
        .with('tokenInfo', tokenInfo)
        .with(
          'receiptTokenAddress',
          getAddress('0x1111111111111111111111111111111111111111'),
        )
        .with('balance', '500000000000000000')
        .with('balanceFiat', '500.75')
        .with('priceChangePercentage1d', '-1.2')
        .build();

      const group = appPositionGroupBuilder()
        .with('name', 'Test Group')
        .with('items', [position])
        .build();

      const appBalance = appBalanceBuilder().with('groups', [group]).build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [appBalance])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      const mappedPosition = result.positionBalances[0].groups[0].items[0];

      expect(mappedPosition.key).toBe('pos-key-123');
      expect(mappedPosition.type).toBe('staking');
      expect(mappedPosition.name).toBe('Staked Position');
      expect(mappedPosition.tokenInfo.address).toBe(tokenInfo.address);
      expect(mappedPosition.tokenInfo.chainId).toBe('137');
      expect(mappedPosition.tokenInfo.type).toBe('ERC20');
      expect(mappedPosition.tokenInfo.trusted).toBe(true);
      expect(mappedPosition.receiptTokenAddress).toBe(
        getAddress('0x1111111111111111111111111111111111111111'),
      );
      expect(mappedPosition.balance).toBe('500000000000000000');
      expect(mappedPosition.balanceFiat).toBe('500.75');
      expect(mappedPosition.priceChangePercentage1d).toBe('-1.2');
    });

    it('should map null address to NULL_ADDRESS for app positions', () => {
      const tokenInfo = tokenInfoBuilder()
        .with('address', null)
        .with('type', 'NATIVE_TOKEN' as const)
        .build();

      const position = appPositionBuilder()
        .with('tokenInfo', tokenInfo)
        .build();

      const group = appPositionGroupBuilder().with('items', [position]).build();

      const appBalance = appBalanceBuilder().with('groups', [group]).build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [appBalance])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(
        result.positionBalances[0].groups[0].items[0].tokenInfo.address,
      ).toBe(NULL_ADDRESS);
      expect(result.positionBalances[0].groups[0].items[0].tokenInfo.type).toBe(
        'NATIVE_TOKEN',
      );
    });

    it('should map null receiptTokenAddress correctly', () => {
      const position = appPositionBuilder()
        .with('receiptTokenAddress', undefined)
        .build();

      const group = appPositionGroupBuilder().with('items', [position]).build();

      const appBalance = appBalanceBuilder().with('groups', [group]).build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [appBalance])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(
        result.positionBalances[0].groups[0].items[0].receiptTokenAddress,
      ).toBeUndefined();
    });

    it('should handle empty portfolios', () => {
      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [])
        .with('positionBalances', [])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(result.tokenBalances).toHaveLength(0);
      expect(result.positionBalances).toHaveLength(0);
      expect(result.totalBalanceFiat).toBeDefined();
      expect(result.totalTokenBalanceFiat).toBeDefined();
      expect(result.totalPositionsBalanceFiat).toBeDefined();
    });

    it('should map multiple token types correctly', () => {
      const erc20Token = tokenBalanceBuilder()
        .with(
          'tokenInfo',
          tokenInfoBuilder()
            .with('type', 'ERC20' as const)
            .build(),
        )
        .build();

      const nativeToken = tokenBalanceBuilder()
        .with(
          'tokenInfo',
          tokenInfoBuilder()
            .with('type', 'NATIVE_TOKEN' as const)
            .with('address', null)
            .build(),
        )
        .build();

      const domainPortfolio = portfolioBuilder()
        .with('tokenBalances', [erc20Token, nativeToken])
        .with('positionBalances', [])
        .build();

      const result = mapper.mapDomainToRoute(domainPortfolio);

      expect(result.tokenBalances).toHaveLength(2);
      expect(result.tokenBalances[0].tokenInfo.type).toBe('ERC20');
      expect(result.tokenBalances[1].tokenInfo.type).toBe('NATIVE_TOKEN');
      expect(result.tokenBalances[1].tokenInfo.address).toBe(NULL_ADDRESS);
    });
  });
});
