import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import { tokenBalanceBuilder } from '@/domain/portfolio/entities/__tests__/token-balance.builder';
import { appBalanceBuilder } from '@/domain/portfolio/entities/__tests__/app-balance.builder';

/**
 * Custom builder for Portfolio that automatically recalculates totals
 * when tokenBalances or positionBalances are overridden.
 */
class PortfolioBuilder extends Builder<Portfolio> {
  private tokenBalances: Array<TokenBalance> = [
    tokenBalanceBuilder().build(),
    tokenBalanceBuilder().build(),
    tokenBalanceBuilder().build(),
  ];

  private positionBalances: Array<AppBalance> = [
    appBalanceBuilder().build(),
    appBalanceBuilder().build(),
  ];

  with<K extends keyof Portfolio>(key: K, value: Portfolio[K]): this {
    // Update internal state for token/position balances
    if (key === 'tokenBalances') {
      this.tokenBalances = value as Array<TokenBalance>;
      this._recalculateTotals();
    } else if (key === 'positionBalances') {
      this.positionBalances = value as Array<AppBalance>;
      this._recalculateTotals();
    }

    // Call parent with method
    return super.with(key, value);
  }

  build(): Portfolio {
    // Ensure totals are calculated before building
    this._recalculateTotals();
    return super.build();
  }

  private _recalculateTotals(): void {
    const totalTokenBalanceFiat = this.tokenBalances.reduce(
      (sum, token) => sum + (token.balanceFiat ?? 0),
      0,
    );
    const totalPositionsBalanceFiat = this.positionBalances.reduce(
      (sum, app) => sum + (app.balanceFiat ?? 0),
      0,
    );

    // Update totals in the builder
    super.with('totalTokenBalanceFiat', totalTokenBalanceFiat);
    super.with('totalPositionsBalanceFiat', totalPositionsBalanceFiat);
    super.with('totalBalanceFiat', totalTokenBalanceFiat + totalPositionsBalanceFiat);
  }
}

export function portfolioBuilder(): IBuilder<Portfolio> {
  return new PortfolioBuilder()
    .with('tokenBalances', [
      tokenBalanceBuilder().build(),
      tokenBalanceBuilder().build(),
      tokenBalanceBuilder().build(),
    ])
    .with('positionBalances', [
      appBalanceBuilder().build(),
      appBalanceBuilder().build(),
    ])
    .with('pnl', null);
}
