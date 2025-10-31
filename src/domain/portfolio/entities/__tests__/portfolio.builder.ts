import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Portfolio } from '@/domain/portfolio/entities/portfolio.entity';
import type { TokenBalance } from '@/domain/portfolio/entities/token-balance.entity';
import type { AppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import { tokenBalanceBuilder } from '@/domain/portfolio/entities/__tests__/token-balance.builder';
import { appBalanceBuilder } from '@/domain/portfolio/entities/__tests__/app-balance.builder';

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
    if (key === 'tokenBalances') {
      this.tokenBalances = value as Array<TokenBalance>;
      this._recalculateTotals();
    } else if (key === 'positionBalances') {
      this.positionBalances = value as Array<AppBalance>;
      this._recalculateTotals();
    }

    return super.with(key, value);
  }

  build(): Portfolio {
    this._recalculateTotals();
    return super.build();
  }

  private _recalculateTotals(): void {
    const totalTokenBalanceFiat = this.tokenBalances.reduce(
      (sum, token) => sum + (token.balanceFiat ? Number(token.balanceFiat) : 0),
      0,
    );
    const totalPositionsBalanceFiat = this.positionBalances.reduce(
      (sum, app) => sum + (app.balanceFiat ? Number(app.balanceFiat) : 0),
      0,
    );

    super.with('totalTokenBalanceFiat', totalTokenBalanceFiat.toString());
    super.with(
      'totalPositionsBalanceFiat',
      totalPositionsBalanceFiat.toString(),
    );
    super.with(
      'totalBalanceFiat',
      (totalTokenBalanceFiat + totalPositionsBalanceFiat).toString(),
    );
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
    ]);
}
