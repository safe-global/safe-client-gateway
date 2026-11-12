// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { getNumberString } from '#/domain/common/utils/utils';
import type { Balance } from '#/modules/balances/domain/entities/balance.entity';
import type { PortfolioSnapshot } from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';
import { sumPortfolioRows } from '#/modules/portfolio/domain/portfolio-totals';
import {
  PortfolioSummary,
  PortfolioSummarySnapshot,
} from '#/modules/portfolio/routes/v2/entities/portfolio-summary.dto.entity';

/** Sums the snapshot's rows, the same rows the Assets page lists, so the totals match. */
@Injectable()
export class PortfolioSummaryMapper {
  fromSnapshot(args: {
    chainId: string;
    address: Address;
    snapshot: PortfolioSnapshot;
  }): PortfolioSummary {
    const totals = sumPortfolioRows(args.snapshot);
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
