// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Builder, type IBuilder } from '@/__tests__/builder';
import type { PolicyIndexerState } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';

export type RawIndexerMeta = {
  chainId: number;
  progressBlock: number;
  sourceBlock: number;
  isReady: boolean;
};

export function rawIndexerMetaBuilder(): IBuilder<RawIndexerMeta> {
  const block = faker.number.int({ min: 1, max: 100_000_000 });

  return new Builder<RawIndexerMeta>()
    .with('chainId', 11155111)
    .with('progressBlock', block)
    .with('sourceBlock', block)
    .with('isReady', true);
}

/**
 * The `data` object of a well-formed indexer response.
 */
export function rawPolicyIndexerState(
  overrides: Partial<{
    _meta: Array<unknown>;
    SafeAllowance: Array<unknown>;
    SafeDelegate: Array<unknown>;
  }> = {},
): Record<string, Array<unknown>> {
  return {
    _meta: [rawIndexerMetaBuilder().build()],
    SafeAllowance: [],
    SafeDelegate: [],
    ...overrides,
  };
}

/**
 * Parsed policy state, as a repository returns it.
 *
 * Assemblers consume the parsed form, so their specs build this rather than the
 * raw rows the datasource sees.
 */
export function policyIndexerStateBuilder(): IBuilder<PolicyIndexerState> {
  return new Builder<PolicyIndexerState>()
    .with('meta', [])
    .with('allowances', [])
    .with('delegates', []);
}
