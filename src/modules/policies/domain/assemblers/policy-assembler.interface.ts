// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerState } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * Everything an assembler needs about one Safe.
 *
 * `state` is already scoped to `safe`, so an assembler never filters by Safe and
 * cannot accidentally report another Safe's rows.
 */
export type PolicyAssemblerContext = {
  safe: SafeRef;
  state: PolicyIndexerState;
  /** The Safe's enabled modules, which is what makes a module policy enforced. */
  enabledModules: ReadonlyArray<Address>;
  /**
   * The guard set on the Safe, which is what makes a guard policy enforced.
   *
   * Only the transaction guard slot: the module guard cannot be read from the
   * Transaction Service's single-Safe endpoint yet (WA-2914).
   */
  transactionGuard: Address | null;
  /** Unix seconds, passed in so an assembler stays a pure function. */
  now: number;
};

/**
 * Turns the indexer's current-state rows into the policies of one type.
 *
 * The indexer has already aggregated the event history, so an assembler maps and
 * groups - it never folds deltas. Adding a policy type is one assembler plus one
 * registry entry, and no change to the route service.
 *
 * An assembler is not keyed by policy type: guard bindings of five different
 * types come from one table, so one assembler reports all of them.
 */
export interface PolicyAssembler {
  assemble(context: PolicyAssemblerContext): Array<ActivePolicy>;
}
