// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  zerionWalletPortfolioAttributesBuilder,
  zerionWalletPortfolioSnapshotBuilder,
} from '#/modules/balances/datasources/entities/__tests__/zerion-wallet-portfolio.entity.builder';
import {
  ZerionWalletPortfolioSchema,
  ZerionWalletPortfolioSnapshotSchema,
} from '#/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';

describe('ZerionWalletPortfolioSchema', () => {
  it('lower-cases the per-chain distribution keys', () => {
    const value = faker.number.float();

    const result = ZerionWalletPortfolioSchema.parse({
      data: {
        type: 'portfolio',
        id: faker.string.uuid(),
        attributes: {
          total: { positions: value },
          positions_distribution_by_chain: { Ethereum: value },
        },
      },
    });

    expect(result.data.attributes.positions_distribution_by_chain).toEqual({
      ethereum: value,
    });
  });

  it('keeps the 1-day changes and the per-type distribution', () => {
    const attributes = zerionWalletPortfolioAttributesBuilder().build();

    const result = ZerionWalletPortfolioSchema.parse({
      data: { type: 'portfolio', id: faker.string.uuid(), attributes },
    });

    expect(result.data.attributes.changes).toEqual(attributes.changes);
    expect(result.data.attributes.positions_distribution_by_type).toEqual(
      attributes.positions_distribution_by_type,
    );
  });

  it('accepts null 1-day changes', () => {
    const attributes = zerionWalletPortfolioAttributesBuilder()
      .with('changes', { absolute_1d: null, percent_1d: null })
      .build();

    const result = ZerionWalletPortfolioSchema.parse({
      data: { type: 'portfolio', id: faker.string.uuid(), attributes },
    });

    expect(result.data.attributes.changes).toEqual({
      absolute_1d: null,
      percent_1d: null,
    });
  });

  it('drops a malformed 1-day change or per-type distribution instead of failing', () => {
    const { total, positions_distribution_by_chain } =
      zerionWalletPortfolioAttributesBuilder().build();

    const result = ZerionWalletPortfolioSchema.parse({
      data: {
        type: 'portfolio',
        id: faker.string.uuid(),
        attributes: {
          total,
          positions_distribution_by_chain,
          changes: faker.string.alpha(),
          positions_distribution_by_type: { wallet: faker.string.alpha() },
        },
      },
    });

    expect(result.data.attributes.changes).toBeUndefined();
    expect(
      result.data.attributes.positions_distribution_by_type,
    ).toBeUndefined();
    expect(result.data.attributes.total).toEqual(total);
  });

  it('parses an entry cached before the changes and per-type distribution were kept', () => {
    const { total, positions_distribution_by_chain } =
      zerionWalletPortfolioAttributesBuilder().build();

    const result = ZerionWalletPortfolioSchema.parse({
      data: {
        type: 'portfolio',
        id: faker.string.uuid(),
        attributes: { total, positions_distribution_by_chain },
      },
    });

    expect(result.data.attributes.changes).toBeUndefined();
    expect(
      result.data.attributes.positions_distribution_by_type,
    ).toBeUndefined();
  });
});

describe('ZerionWalletPortfolioSnapshotSchema', () => {
  it('requires the fetch and expiry timestamps', () => {
    const { data } = zerionWalletPortfolioSnapshotBuilder().build();

    const result = ZerionWalletPortfolioSnapshotSchema.safeParse({ data });

    expect(result.success).toBe(false);
  });
});
