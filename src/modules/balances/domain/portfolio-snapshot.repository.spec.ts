// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import { zerionWalletPortfolioSnapshotBuilder } from '#/modules/balances/datasources/entities/__tests__/zerion-wallet-portfolio.entity.builder';
import type { IZerionWalletPortfolioApi } from '#/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import { PortfolioSnapshotRepository } from '#/modules/balances/domain/portfolio-snapshot.repository';
import { rawify } from '#/validation/entities/raw.entity';

const mockZerionWalletPortfolioApi = vi.mocked({
  getPortfolioSnapshot: vi.fn(),
} as unknown as MockedObject<IZerionWalletPortfolioApi>);

describe('PortfolioSnapshotRepository', () => {
  const repository = new PortfolioSnapshotRepository(
    mockZerionWalletPortfolioApi,
  );
  const identity = {
    address: getAddress(faker.finance.ethereumAddress()),
    currency: faker.helpers.arrayElement(['USD', 'EUR']),
    isTestnet: faker.datatype.boolean(),
    trusted: faker.datatype.boolean(),
  };

  it('maps the Zerion snapshot to the domain snapshot', async () => {
    const snapshot = zerionWalletPortfolioSnapshotBuilder().build();
    const { attributes } = snapshot.data;
    mockZerionWalletPortfolioApi.getPortfolioSnapshot.mockResolvedValue(
      rawify(snapshot),
    );

    const result = await repository.getSnapshot(identity);

    expect(
      mockZerionWalletPortfolioApi.getPortfolioSnapshot,
    ).toHaveBeenCalledWith(identity);
    expect(result).toEqual({
      fiatTotal: attributes.total.positions,
      fiatChange1d: attributes.changes?.absolute_1d,
      percentChange1d: attributes.changes?.percent_1d,
      fiatTotalByNetwork: attributes.positions_distribution_by_chain,
      fiatTotalByType: attributes.positions_distribution_by_type,
      updatedAt: new Date(snapshot.fetchedAt),
      expiresAt: new Date(snapshot.expiresAt),
    });
  });

  it('defaults the changes and per-type distribution when Zerion omits them', async () => {
    const snapshot = zerionWalletPortfolioSnapshotBuilder().build();
    const { total, positions_distribution_by_chain } = snapshot.data.attributes;
    mockZerionWalletPortfolioApi.getPortfolioSnapshot.mockResolvedValue(
      rawify({
        ...snapshot,
        data: {
          ...snapshot.data,
          attributes: { total, positions_distribution_by_chain },
        },
      }),
    );

    const result = await repository.getSnapshot(identity);

    expect(result.fiatChange1d).toBeNull();
    expect(result.percentChange1d).toBeNull();
    expect(result.fiatTotalByType).toEqual({});
  });

  it('throws on a malformed snapshot', async () => {
    const { data } = zerionWalletPortfolioSnapshotBuilder().build();
    mockZerionWalletPortfolioApi.getPortfolioSnapshot.mockResolvedValue(
      rawify({ data }),
    );

    await expect(repository.getSnapshot(identity)).rejects.toThrow(ZodError);
  });
});
