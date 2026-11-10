// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { getNumberString } from '#/domain/common/utils/utils';
import type { Balance } from '#/modules/balances/domain/entities/balance.entity';
import type { PortfolioSnapshot } from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';
import {
  PortfolioSummary,
  PortfolioSummarySnapshot,
} from '#/modules/portfolio/routes/v2/entities/portfolio-summary.dto.entity';
import { PositionType } from '#/modules/positions/domain/entities/position-type.entity';

/**
 * Builds portfolio summaries. Zerion values are summed from the snapshot's
 * rows (every token and DeFi position), the same rows the Assets page lists,
 * so every total matches it.
 */
@Injectable()
export class PortfolioSummaryMapper {
  /**
   * @param args.chainId - The Safe's chain, which picks its value out of the snapshot
   * @param args.address - The Safe's address
   * @param args.snapshot - The address's snapshot for the chain's environment
   * @returns The summary, valued from the snapshot
   */
  fromSnapshot(args: {
    chainId: string;
    address: Address;
    snapshot: PortfolioSnapshot;
  }): PortfolioSummary {
    const totals = this.sumRows(args.snapshot);
    return new PortfolioSummary({
      chainId: args.chainId,
      address: args.address,
      // The chain is on Zerion, so having no rows there means holding nothing.
      fiatTotal: getNumberString(totals.byChain[args.chainId] ?? 0),
      source: 'zerion',
      snapshot: new PortfolioSummarySnapshot({
        fiatTotal: getNumberString(totals.total),
        fiatTotalByChain: this.toDecimalStrings(totals.byChain),
        fiatTotalByType: this.toDecimalStrings(totals.byType),
        updatedAt: new Date(args.snapshot.fetchedAt),
        expiresAt: new Date(args.snapshot.expiresAt),
      }),
    });
  }

  /**
   * @param args.chainId - The Safe's chain
   * @param args.address - The Safe's address
   * @param args.balances - The Safe's Transaction Service balances on that chain
   * @returns The summary, valued from the balances, without a snapshot
   */
  fromBalances(args: {
    chainId: string;
    address: Address;
    balances: Array<Balance>;
  }): PortfolioSummary {
    const fiatTotal = args.balances.reduce((total, { fiatBalance }) => {
      const value = Number(fiatBalance);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    return new PortfolioSummary({
      chainId: args.chainId,
      address: args.address,
      fiatTotal: getNumberString(fiatTotal),
      source: 'tx_service',
      snapshot: null,
    });
  }

  private sumRows(snapshot: PortfolioSnapshot): {
    total: number;
    byChain: Record<string, number>;
    byType: Record<string, number>;
  } {
    let total = 0;
    const byChain: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const add = (chainId: string, type: string, balanceFiat?: string): void => {
      // Unpriced rows carry no fiat value and count as nothing.
      const value = Number(balanceFiat ?? 0);
      total += value;
      byChain[chainId] = (byChain[chainId] ?? 0) + value;
      byType[type] = (byType[type] ?? 0) + value;
    };
    for (const token of snapshot.tokenBalances) {
      add(token.tokenInfo.chainId, PositionType.wallet, token.balanceFiat);
    }
    for (const app of snapshot.positionBalances) {
      for (const item of app.groups.flatMap(({ items }) => items)) {
        add(item.tokenInfo.chainId, item.type, item.balanceFiat);
      }
    }
    return { total, byChain, byType };
  }

  private toDecimalStrings(
    values: Record<string, number>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        getNumberString(value),
      ]),
    );
  }
}
