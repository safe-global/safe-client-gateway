// SPDX-License-Identifier: FSL-1.1-MIT
import type { Portfolio } from '#/modules/portfolio/domain/entities/portfolio.entity';
import { PositionType } from '#/modules/positions/domain/entities/position-type.entity';

/** Fiat totals of a portfolio's rows: overall, per chain ID and per position type. */
export type PortfolioTotals = {
  total: number;
  byChain: Record<string, number>;
  byType: Record<string, number>;
};

/**
 * Sums every token and position row, the rows the Assets page lists, so every
 * route that values a Safe from the same portfolio shows the same number.
 */
export function sumPortfolioRows(
  portfolio: Pick<Portfolio, 'tokenBalances' | 'positionBalances'>,
): PortfolioTotals {
  const totals: PortfolioTotals = { total: 0, byChain: {}, byType: {} };
  const add = (chainId: string, type: string, balanceFiat?: string): void => {
    const value = Number(balanceFiat ?? 0);
    totals.total += value;
    totals.byChain[chainId] = (totals.byChain[chainId] ?? 0) + value;
    totals.byType[type] = (totals.byType[type] ?? 0) + value;
  };
  for (const token of portfolio.tokenBalances) {
    add(token.tokenInfo.chainId, PositionType.wallet, token.balanceFiat);
  }
  for (const app of portfolio.positionBalances) {
    for (const item of app.groups.flatMap(({ items }) => items)) {
      add(item.tokenInfo.chainId, item.type, item.balanceFiat);
    }
  }
  return totals;
}
