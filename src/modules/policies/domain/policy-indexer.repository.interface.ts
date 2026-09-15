// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { PolicyIndexerState } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

export const IPolicyIndexerRepository = Symbol('IPolicyIndexerRepository');

export interface IPolicyIndexerRepository {
  /**
   * Current policy state for {@link safes}.
   * @param args.safes Array of Safe address and chain id pairs.
   */
  getState(args: {
    safes: ReadonlyArray<SafeRef>;
  }): Promise<PolicyIndexerState>;

  /**
   * Forgets the cached policy state of one Safe.
   *
   * Called from the transaction hooks: every policy change is a Safe
   * transaction, and an allowance transfer updates the spending limit.
   */
  clearState(args: { chainId: string; safeAddress: Address }): Promise<void>;
}
