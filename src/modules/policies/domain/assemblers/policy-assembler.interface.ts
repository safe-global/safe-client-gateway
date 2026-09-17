// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerState } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * The indexer's rows an assembler reads.
 *
 * The repository sets the boolean flag `isDelegateActive` for each allowance from `delegates` list.
 * So, `delegates` is not needed and hence dropped.
 */
export type PolicyAssemblerState = Omit<PolicyIndexerState, 'delegates'>;

/**
 * Everything an assembler needs about one Safe.
 *
 * `state` is already scoped to `safe`, so an assembler never filters by Safe.
 */
export type PolicyAssemblerContext = {
  safe: SafeRef;
  state: PolicyAssemblerState;
  /** The Safe's enabled modules, which is what makes a module policy enforced. */
  enabledModules: ReadonlyArray<Address>;
};

/**
 * Turns the indexer's current-state rows into the policies of one type.
 */
export interface PolicyAssembler {
  assemble(context: PolicyAssemblerContext): Array<ActivePolicy>;
}

/**
 * The registered {@link PolicyAssembler}s.
 */
export const POLICY_ASSEMBLERS = Symbol('POLICY_ASSEMBLERS');
