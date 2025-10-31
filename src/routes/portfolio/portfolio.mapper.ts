import { Injectable } from '@nestjs/common';
import type { Portfolio as DomainPortfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance as DomainTokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance as DomainAppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import type {
  AppPosition as DomainAppPosition,
  AppPositionGroup as DomainAppPositionGroup,
} from '@/domain/portfolio/entities/app-position.entity';
import type { Portfolio } from '@/routes/portfolio/entities/portfolio.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import type { TokenBalance } from '@/routes/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/routes/portfolio/entities/app-balance.entity';
import type { AppPosition } from '@/routes/portfolio/entities/app-position.entity';
import type { AppPositionGroup } from '@/routes/portfolio/entities/app-position-group.entity';

/**
 * Portfolio route mapper.
 * Maps internal domain portfolio entities to external route/API portfolio entities.
 * Note: ZerionPortfolioApi maps from Zerion (external IN) to domain (internal).
 */
@Injectable()
export class PortfolioRouteMapper {
  public constructor() {}

  /**
   * Maps domain portfolio to route portfolio format.
   *
   * @param domainPortfolio - Domain portfolio entity
   */
  public mapDomainToRoute(domainPortfolio: DomainPortfolio): Portfolio {
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

  /**
   * Maps domain token balance to route token balance.
   *
   * @param token - Domain token balance
   */
  private mapTokenBalance(token: DomainTokenBalance): TokenBalance {
    return {
      ...token,
      tokenInfo: {
        ...token.tokenInfo,
        address: token.tokenInfo.address ?? NULL_ADDRESS,
      },
    };
  }

  /**
   * Maps domain app position to route app position.
   *
   * @param position - Domain app position
   */
  private mapAppPosition(position: DomainAppPosition): AppPosition {
    return {
      ...position,
      groupId: position.groupId ?? null,
      tokenInfo: {
        ...position.tokenInfo,
        address: position.tokenInfo.address ?? NULL_ADDRESS,
      },
    };
  }

  /**
   * Maps domain app balance to route app balance.
   *
   * @param app - Domain app balance
   */
  private mapAppBalance(app: DomainAppBalance): AppBalance {
    return {
      appInfo: {
        name: app.appInfo.name,
        logoUrl: app.appInfo.logoUrl,
        url: app.appInfo.url,
      },
      balanceFiat: app.balanceFiat,
      groups: app.groups.map((group) => this.mapAppPositionGroup(group)),
    };
  }

  /**
   * Maps domain app position group to route app position group.
   *
   * @param group - Domain app position group
   */
  private mapAppPositionGroup(group: DomainAppPositionGroup): AppPositionGroup {
    return {
      name: group.name,
      items: group.items.map((position) => this.mapAppPosition(position)),
    };
  }
}
