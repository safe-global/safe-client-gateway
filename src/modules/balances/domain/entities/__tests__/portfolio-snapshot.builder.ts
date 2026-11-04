// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import type { PortfolioSnapshot } from '#/modules/balances/domain/entities/portfolio-snapshot.entity';

const fiatValue = (): number =>
  faker.number.float({ min: 0, max: 1_000_000, fractionDigits: 2 });

export function portfolioSnapshotBuilder(): IBuilder<PortfolioSnapshot> {
  const updatedAt = faker.date.recent();
  return new Builder<PortfolioSnapshot>()
    .with('fiatTotal', fiatValue())
    .with('fiatChange1d', faker.number.float({ min: -1_000, max: 1_000 }))
    .with('percentChange1d', faker.number.float({ min: -100, max: 100 }))
    .with('fiatTotalByNetwork', {
      [faker.string.alpha({ length: 8, casing: 'lower' })]: fiatValue(),
    })
    .with('fiatTotalByType', { wallet: fiatValue(), deposited: fiatValue() })
    .with('updatedAt', updatedAt)
    .with(
      'expiresAt',
      new Date(
        updatedAt.getTime() + faker.number.int({ min: 60, max: 3_600 }) * 1_000,
      ),
    );
}
