import { Injectable } from '@nestjs/common';
import type { Portfolio as DomainPortfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';
import type { TokenBalance as DomainTokenBalance } from '@/modules/portfolio/domain/entities/token-balance.entity';
import type { AppBalance as DomainAppBalance } from '@/modules/portfolio/domain/entities/app-balance.entity';
import type {
  AppPosition as DomainAppPosition,
  AppPositionGroup as DomainAppPositionGroup,
} from '@/modules/portfolio/domain/entities/app-position.entity';
import type { Portfolio } from '@/modules/portfolio/v1/entities/portfolio.entity';
import { NULL_ADDRESS } from '@/routes/common/constants';
import type { TokenBalance } from '@/modules/portfolio/v1/entities/token-balance.entity';
import type { AppBalance } from '@/modules/portfolio/v1/entities/app-balance.entity';
import type { AppPosition } from '@/modules/portfolio/v1/entities/app-position.entity';
import type { AppPositionGroup } from '@/modules/portfolio/v1/entities/app-position-group.entity';

/**
 * Portfolio route mapper.
 * Maps internal domain portfolio entities to external route/API portfolio entities.
 * Note: ZerionPortfolioApi maps from Zerion (external IN) to domain (internal).
 */
@Injectable()
export class PortfolioRouteMapper {
  /**
   * Maps domain portfolio to route portfolio format.
   *
   * @param {DomainPortfolio} domainPortfolio - Domain portfolio entity
   * @returns {Portfolio} Route portfolio entity
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
   * @param {DomainTokenBalance} token - Domain token balance
   * @returns {TokenBalance} Route token balance entity
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
   * @param {DomainAppPosition} position - Domain app position
   * @returns {AppPosition} Route app position entity
   */
  private mapAppPosition(position: DomainAppPosition): AppPosition {
    return {
      ...position,
      groupId: position.groupId ?? undefined,
      tokenInfo: {
        ...position.tokenInfo,
        address: position.tokenInfo.address ?? NULL_ADDRESS,
      },
    };
  }

  /**
   * Maps domain app balance to route app balance.
   *
   * @param {DomainAppBalance} app - Domain app balance
   * @returns {AppBalance} Route app balance entity
   */
  private mapAppBalance(app: DomainAppBalance): AppBalance {
    return {
      appInfo: {
        ...app.appInfo,
      },
      balanceFiat: app.balanceFiat,
      groups: app.groups.map((group) => this.mapAppPositionGroup(group)),
    };
  }

  /**
   * Maps domain app position group to route app position group.
   *
   * @param {DomainAppPositionGroup} group - Domain app position group
   * @returns {AppPositionGroup} Route app position group entity
   */
  private mapAppPositionGroup(group: DomainAppPositionGroup): AppPositionGroup {
    return {
      name: group.name,
      items: group.items.map((position) => this.mapAppPosition(position)),
    };
  }
}
