// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { portfolioBuilder } from '#/modules/portfolio/domain/entities/__tests__/portfolio.builder';
import type { PortfolioSnapshot } from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';

export function portfolioSnapshotBuilder(): IBuilder<PortfolioSnapshot> {
  const portfolio = portfolioBuilder().build();
  const fetchedAt = faker.date.recent().getTime();
  return new Builder<PortfolioSnapshot>()
    .with('totalBalanceFiat', portfolio.totalBalanceFiat)
    .with('totalTokenBalanceFiat', portfolio.totalTokenBalanceFiat)
    .with('totalPositionsBalanceFiat', portfolio.totalPositionsBalanceFiat)
    .with('tokenBalances', portfolio.tokenBalances)
    .with('positionBalances', portfolio.positionBalances)
    .with('fetchedAt', fetchedAt)
    .with(
      'expiresAt',
      fetchedAt + faker.number.int({ min: 60, max: 3_600 }) * 1_000,
    );
}
