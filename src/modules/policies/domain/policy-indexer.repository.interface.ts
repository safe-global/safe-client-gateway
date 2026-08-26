// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { PolicyIndexerState } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

export const IPolicyIndexerRepository = Symbol('IPolicyIndexerRepository');

export interface IPolicyIndexerRepository {
  /**
   * Current policy state for {@link safes}, validated.
   *
   * One upstream request regardless of how many Safes are asked for, so a
   * Space-level read does not grow with the size of the Space.
   *
   * Rows the schemas cannot read are dropped and logged rather than failing the
   * read: a policy kind added by a newer indexer release must not blank a Safe's
   * policies. A failure of the request itself does propagate - a partial answer
   * on a page whose purpose is saying what controls a Safe would read as
   * "nothing controls it".
   *
   * @param args.safes - non-empty; an empty set returns empty state without a
   * request.
   */
  getState(args: {
    safes: ReadonlyArray<SafeRef>;
  }): Promise<PolicyIndexerState>;

  /**
   * Forgets the cached policy state of one Safe.
   *
   * Called from the transaction hooks: every policy change is a Safe
   * transaction, and an allowance transfer moves what a spending limit has left
   * without changing any configuration at all.
   */
  clearState(args: { chainId: string; safeAddress: Address }): Promise<void>;
}
