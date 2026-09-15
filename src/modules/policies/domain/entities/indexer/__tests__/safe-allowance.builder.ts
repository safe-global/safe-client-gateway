// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';

/**
 * Builders for the Policy Indexer's rows **as served**, not as parsed: `chainId`
 * is a number, every `numeric` column is a decimal string, and the custom
 * scalars are plain strings. A builder of the parsed form would stop exercising
 * the conversions those two facts exist for.
 */

export type RawIndexerSafeAllowance = {
  chainId: number;
  safe: string;
  module: string;
  moduleVersion: string;
  delegate: string;
  token: string;
  amount: string;
  spent: string;
  remaining: string;
  resetTimeMinutes: string;
  lastResetMin: string;
  resetPhase: string;
  nonce: string;
  updatedAt: string;
};

export function rawIndexerSafeAllowanceBuilder(): IBuilder<RawIndexerSafeAllowance> {
  const amount = faker.number.bigInt({ min: 1n, max: 10n ** 24n });
  const spent = faker.number.bigInt({ min: 0n, max: amount });
  const resetTimeMinutes = faker.helpers.arrayElement([0, 60, 1440, 10080]);
  // Minutes since the epoch, as the module stores it - roughly 2023 to 2027.
  const lastResetMin = faker.number.int({
    min: 28_000_000,
    max: 30_000_000,
  });

  return (
    new Builder<RawIndexerSafeAllowance>()
      .with('chainId', 11155111)
      .with('safe', getAddress(faker.finance.ethereumAddress()))
      .with('module', getAddress(faker.finance.ethereumAddress()))
      .with('moduleVersion', faker.helpers.arrayElement(['0.1.0', '0.1.1']))
      .with('delegate', getAddress(faker.finance.ethereumAddress()))
      .with('token', getAddress(faker.finance.ethereumAddress()))
      .with('amount', amount.toString())
      .with('spent', spent.toString())
      .with('remaining', (amount - spent).toString())
      .with('resetTimeMinutes', resetTimeMinutes.toString())
      .with('lastResetMin', lastResetMin.toString())
      // Zero-period rows carry `EXACT` too: there is no boundary to be wrong about.
      .with('resetPhase', 'EXACT')
      .with('nonce', faker.number.int({ min: 0, max: 65_535 }).toString())
      .with(
        'updatedAt',
        // Unix seconds, so at or after the window it belongs to.
        (
          lastResetMin * 60 +
          faker.number.int({ min: 0, max: 3_600 })
        ).toString(),
      )
  );
}

export type RawIndexerSafeDelegate = {
  chainId: number;
  safe: string;
  module: string;
  moduleVersion: string;
  delegate: string;
  active: boolean;
  addedAt: string;
  updatedAt: string;
};

export function rawIndexerSafeDelegateBuilder(): IBuilder<RawIndexerSafeDelegate> {
  const addedAt = faker.number.int({ min: 1_700_000_000, max: 1_800_000_000 });

  return new Builder<RawIndexerSafeDelegate>()
    .with('chainId', 11155111)
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('module', getAddress(faker.finance.ethereumAddress()))
    .with('moduleVersion', '0.1.0')
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('active', true)
    .with('addedAt', addedAt.toString())
    .with('updatedAt', addedAt.toString());
}

/**
 * An allowance as a repository returns it: `chainId` a string, base units
 * strings, minutes and seconds numbers, and the delegate's registration folded
 * in.
 */
export function policyIndexerSafeAllowanceBuilder(): IBuilder<PolicyIndexerSafeAllowance> {
  const raw = rawIndexerSafeAllowanceBuilder().build();

  return (
    new Builder<PolicyIndexerSafeAllowance>()
      .with('chainId', String(raw.chainId))
      .with('safe', getAddress(raw.safe))
      .with('module', getAddress(raw.module))
      .with('moduleVersion', raw.moduleVersion)
      .with('delegate', getAddress(raw.delegate))
      .with('token', getAddress(raw.token))
      .with('amount', raw.amount)
      .with('spent', raw.spent)
      .with('remaining', raw.remaining)
      .with('resetTimeMinutes', Number(raw.resetTimeMinutes))
      .with('lastResetMin', Number(raw.lastResetMin))
      .with('resetPhase', raw.resetPhase === 'UNKNOWN' ? 'UNKNOWN' : 'EXACT')
      .with('nonce', raw.nonce)
      .with('updatedAt', Number(raw.updatedAt))
      // Folded in by the repository, not served by the indexer.
      .with('isDelegateActive', true)
  );
}
