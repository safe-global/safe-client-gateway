// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, isAddressEqual } from 'viem';
import type { PolicyAssemblerState } from '@/modules/policies/domain/assemblers/policy-assembler.interface';
import type { PolicyIndexerState } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/**
 * The rows of {@link state} belonging to {@link safe}, as an assembler reads
 * them.
 *
 * One indexer read covers every Safe of a request, while an assembler works on
 * one Safe at a time - scoping here is what lets an assembler never filter by
 * Safe, and so never report another Safe's policies.
 *
 * `meta` is per chain rather than per Safe, so the Safe's chain travels with it:
 * the indexing progress beside a Safe's rows is the progress that produced them.
 *
 * `delegates` is dropped - see {@link PolicyAssemblerState}.
 */
export function policyStateForSafe(
  state: PolicyIndexerState,
  safe: SafeRef,
): PolicyAssemblerState {
  const onChain = <T extends { chainId: string }>(row: T): boolean =>
    row.chainId === safe.chainId;
  const onSafe = <T extends { chainId: string; safe: Address }>(
    row: T,
  ): boolean => onChain(row) && isAddressEqual(row.safe, safe.address);

  return {
    meta: state.meta.filter(onChain),
    allowances: state.allowances.filter(onSafe),
  };
}
