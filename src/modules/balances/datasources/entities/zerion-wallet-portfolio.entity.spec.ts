// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ZerionWalletPortfolioSchema } from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';

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
});
