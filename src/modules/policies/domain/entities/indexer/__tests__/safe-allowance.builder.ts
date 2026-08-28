// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type { IndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';

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
  delegateActive: boolean;
  amount: string;
  spent: string;
  remaining: string;
  resetTimeMinutes: string;
  lastResetAt: string;
  nextResetAt: string;
  resetPhase: string;
  nonce: string;
};

export function rawIndexerSafeAllowanceBuilder(): IBuilder<RawIndexerSafeAllowance> {
  const amount = faker.number.bigInt({ min: 1n, max: 10n ** 24n });
  const spent = faker.number.bigInt({ min: 0n, max: amount });
  const resetTimeMinutes = faker.helpers.arrayElement([0, 60, 1440, 10080]);
  const lastResetAt = faker.number.int({
    min: 1_700_000_000,
    max: 1_800_000_000,
  });

  return new Builder<RawIndexerSafeAllowance>()
    .with('chainId', 11155111)
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('module', getAddress(faker.finance.ethereumAddress()))
    .with('moduleVersion', faker.helpers.arrayElement(['0.1.0', '0.1.1']))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('token', getAddress(faker.finance.ethereumAddress()))
    .with('delegateActive', true)
    .with('amount', amount.toString())
    .with('spent', spent.toString())
    .with('remaining', (amount - spent).toString())
    .with('resetTimeMinutes', resetTimeMinutes.toString())
    .with('lastResetAt', lastResetAt.toString())
    .with(
      'nextResetAt',
      resetTimeMinutes === 0
        ? '0'
        : (lastResetAt + resetTimeMinutes * 60).toString(),
    )
    .with('resetPhase', resetTimeMinutes === 0 ? 'NONE' : 'EXACT')
    .with('nonce', faker.number.int({ min: 0, max: 65_535 }).toString());
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
 * A parsed allowance row, as a repository returns it: `chainId` a string, base
 * units strings, seconds and minutes numbers.
 */
export function indexerSafeAllowanceBuilder(): IBuilder<IndexerSafeAllowance> {
  const raw = rawIndexerSafeAllowanceBuilder().build();

  return new Builder<IndexerSafeAllowance>()
    .with('chainId', String(raw.chainId))
    .with('safe', getAddress(raw.safe))
    .with('module', getAddress(raw.module))
    .with('moduleVersion', raw.moduleVersion)
    .with('delegate', getAddress(raw.delegate))
    .with('token', getAddress(raw.token))
    .with('delegateActive', raw.delegateActive)
    .with('amount', raw.amount)
    .with('spent', raw.spent)
    .with('remaining', raw.remaining)
    .with('resetTimeMinutes', Number(raw.resetTimeMinutes))
    .with('lastResetAt', Number(raw.lastResetAt))
    .with('nextResetAt', Number(raw.nextResetAt))
    .with('resetPhase', raw.resetPhase === 'NONE' ? 'NONE' : 'EXACT')
    .with('nonce', raw.nonce);
}
