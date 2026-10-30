// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import type {
  ZerionWalletPortfolioAttributes,
  ZerionWalletPortfolioSnapshot,
} from '#/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';

const fiatValue = (): number =>
  faker.number.float({ min: 0, max: 1_000_000, fractionDigits: 2 });

export function zerionWalletPortfolioAttributesBuilder(): IBuilder<ZerionWalletPortfolioAttributes> {
  return new Builder<ZerionWalletPortfolioAttributes>()
    .with('total', { positions: fiatValue() })
    .with('changes', {
      absolute_1d: faker.number.float({ min: -1_000, max: 1_000 }),
      percent_1d: faker.number.float({ min: -100, max: 100 }),
    })
    .with('positions_distribution_by_chain', {
      [faker.string.alpha({ length: 8, casing: 'lower' })]: fiatValue(),
    })
    .with('positions_distribution_by_type', {
      wallet: fiatValue(),
      deposited: fiatValue(),
      borrowed: fiatValue(),
      locked: fiatValue(),
      staked: fiatValue(),
    });
}

export function zerionWalletPortfolioSnapshotBuilder(): IBuilder<ZerionWalletPortfolioSnapshot> {
  const fetchedAt = faker.date.recent().getTime();
  return new Builder<ZerionWalletPortfolioSnapshot>()
    .with('data', {
      type: 'portfolio',
      id: faker.string.uuid(),
      attributes: zerionWalletPortfolioAttributesBuilder().build(),
    })
    .with('fetchedAt', fetchedAt)
    .with(
      'expiresAt',
      fetchedAt + faker.number.int({ min: 60, max: 3_600 }) * 1_000,
    );
}
