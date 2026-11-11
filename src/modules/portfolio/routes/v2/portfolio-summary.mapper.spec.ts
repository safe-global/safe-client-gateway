// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { getNumberString } from '#/domain/common/utils/utils';
import { balanceBuilder } from '#/modules/balances/domain/entities/__tests__/balance.builder';
import { appBalanceBuilder } from '#/modules/portfolio/domain/entities/__tests__/app-balance.builder';
import { appPositionBuilder } from '#/modules/portfolio/domain/entities/__tests__/app-position.builder';
import { appPositionGroupBuilder } from '#/modules/portfolio/domain/entities/__tests__/app-position-group.builder';
import { portfolioSnapshotBuilder } from '#/modules/portfolio/domain/entities/__tests__/portfolio-snapshot.builder';
import { tokenBalanceBuilder } from '#/modules/portfolio/domain/entities/__tests__/token-balance.builder';
import { tokenInfoBuilder } from '#/modules/portfolio/domain/entities/__tests__/token-info.builder';
import { PortfolioSummaryMapper } from '#/modules/portfolio/routes/v2/portfolio-summary.mapper';
import { PositionType } from '#/modules/positions/domain/entities/position-type.entity';

const fiat = (): number => faker.number.int({ min: 1, max: 1_000_000 }) / 100;

describe('PortfolioSummaryMapper', () => {
  const mapper = new PortfolioSummaryMapper();
  const address = getAddress(faker.finance.ethereumAddress());
  const [chainId, otherChainId] = faker.helpers.uniqueArray(
    () => faker.string.numeric({ length: { min: 1, max: 8 } }),
    2,
  );

  const token = (args: { chainId: string; value?: number }) =>
    tokenBalanceBuilder()
      .with(
        'tokenInfo',
        tokenInfoBuilder().with('chainId', args.chainId).build(),
      )
      .with(
        'balanceFiat',
        args.value === undefined ? undefined : getNumberString(args.value),
      )
      .build();

  const position = (args: { chainId: string; type: string; value: number }) =>
    appPositionBuilder()
      .with(
        'tokenInfo',
        tokenInfoBuilder().with('chainId', args.chainId).build(),
      )
      .with('type', args.type)
      .with('balanceFiat', getNumberString(args.value))
      .build();

  describe('fromSnapshot', () => {
    it('sums every token and position row per chain and per type', () => {
      const [walletHere, walletThere, deposit, loan] = [
        fiat(),
        fiat(),
        fiat(),
        -fiat(),
      ];
      const snapshot = portfolioSnapshotBuilder()
        .with('tokenBalances', [
          token({ chainId, value: walletHere }),
          token({ chainId: otherChainId, value: walletThere }),
          // Unpriced: no fiat value, counts as nothing.
          token({ chainId }),
        ])
        .with('positionBalances', [
          appBalanceBuilder()
            .with('groups', [
              appPositionGroupBuilder()
                .with('items', [
                  position({
                    chainId,
                    type: PositionType.deposit,
                    value: deposit,
                  }),
                  position({ chainId, type: PositionType.loan, value: loan }),
                ])
                .build(),
            ])
            .build(),
        ])
        .build();

      const result = mapper.fromSnapshot({ chainId, address, snapshot });

      expect(result).toEqual({
        chainId,
        address,
        fiatTotal: getNumberString(walletHere + deposit + loan),
        source: 'zerion',
        snapshot: {
          fiatTotal: getNumberString(walletHere + walletThere + deposit + loan),
          fiatTotalByChain: {
            [chainId]: getNumberString(walletHere + deposit + loan),
            [otherChainId]: getNumberString(walletThere),
          },
          fiatTotalByType: {
            [PositionType.wallet]: getNumberString(walletHere + walletThere),
            [PositionType.deposit]: getNumberString(deposit),
            [PositionType.loan]: getNumberString(loan),
          },
          updatedAt: new Date(snapshot.fetchedAt),
          expiresAt: new Date(snapshot.expiresAt),
        },
      });
    });

    it('values a chain without rows at 0', () => {
      const snapshot = portfolioSnapshotBuilder()
        .with('tokenBalances', [
          token({ chainId: otherChainId, value: fiat() }),
        ])
        .with('positionBalances', [])
        .build();

      const result = mapper.fromSnapshot({ chainId, address, snapshot });

      expect(result.fiatTotal).toBe('0');
      expect(result.source).toBe('zerion');
    });
  });

  describe('fromBalances', () => {
    it('sums the priced balances, skipping unpriced and malformed ones', () => {
      const [first, second] = [fiat(), fiat()];
      const balances = [
        balanceBuilder().with('fiatBalance', getNumberString(first)).build(),
        balanceBuilder().with('fiatBalance', getNumberString(second)).build(),
        balanceBuilder().with('fiatBalance', null).build(),
        // Not a number: skipped instead of turning the total into NaN.
        balanceBuilder().with('fiatBalance', faker.string.alpha(8)).build(),
      ];

      const result = mapper.fromBalances({ chainId, address, balances });

      expect(result).toEqual({
        chainId,
        address,
        fiatTotal: getNumberString(first + second),
        source: 'tx_service',
        snapshot: null,
      });
    });
  });
});
