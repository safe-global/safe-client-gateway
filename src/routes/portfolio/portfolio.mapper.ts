import { Injectable } from '@nestjs/common';
import type { Portfolio as DomainPortfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance as DomainTokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance as DomainAppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import type { AppPosition as DomainAppPosition } from '@/domain/portfolio/entities/app-position.entity';
import type { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import type { TokenBalance } from '@/routes/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/routes/portfolio/entities/app-balance.entity';
import type { AppPosition } from '@/routes/portfolio/entities/app-position.entity';

@Injectable()
export class PortfolioMapper {
  public constructor() {}

  public mapZerionPortfolioToApi(domainPortfolio: DomainPortfolio): Portfolio {
    return {
      totalBalanceFiat: domainPortfolio.totalBalanceFiat,
      totalTokenBalanceFiat: domainPortfolio.totalTokenBalanceFiat,
      totalPositionsBalanceFiat: domainPortfolio.totalPositionsBalanceFiat,
      tokenBalances: domainPortfolio.tokenBalances.map((token) =>
        this.mapTokenBalance(token),
      ),
      positionBalances: domainPortfolio.positionBalances.map((app) =>
        this.mapAppBalance(app),
      ),
    };
  }

  private mapTokenBalance(token: DomainTokenBalance): TokenBalance {
    return {
      tokenInfo: {
        address: token.tokenInfo.address ?? NULL_ADDRESS,
        decimals: token.tokenInfo.decimals,
        symbol: token.tokenInfo.symbol,
        name: token.tokenInfo.name,
        logoUri: token.tokenInfo.logoUri,
        chainId: token.tokenInfo.chainId,
        trusted: token.tokenInfo.trusted,
        type: token.tokenInfo.type,
      },
      balance: token.balance,
      balanceFiat: token.balanceFiat,
      price: token.price,
      priceChangePercentage1d: token.priceChangePercentage1d,
    };
  }

  private mapAppPosition(position: DomainAppPosition): AppPosition {
    return {
      key: position.key,
      type: position.type,
      name: position.name,
      tokenInfo: {
        address: position.tokenInfo.address ?? NULL_ADDRESS,
        decimals: position.tokenInfo.decimals,
        symbol: position.tokenInfo.symbol,
        name: position.tokenInfo.name,
        logoUri: position.tokenInfo.logoUri,
        chainId: position.tokenInfo.chainId,
        trusted: position.tokenInfo.trusted,
        type: position.tokenInfo.type,
      },
      balance: position.balance,
      balanceFiat: position.balanceFiat,
      priceChangePercentage1d: position.priceChangePercentage1d,
    };
  }

  private mapAppBalance(app: DomainAppBalance): AppBalance {
    return {
      appInfo: {
        name: app.appInfo.name,
        logoUrl: app.appInfo.logoUrl,
        url: app.appInfo.url,
      },
      balanceFiat: app.balanceFiat,
      positions: app.positions.map((position) => this.mapAppPosition(position)),
    };
  }
}
