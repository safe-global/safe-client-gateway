// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';

/**
 * The events of one `(target, selector, operation)` tuple, i.e. of one guard
 * access, reduced to the policy currently bound to it.
 *
 * This is the unit every policy is derived from. The guard keeps one policy per
 * access, so the tuple's newest event decides which policy is bound and which
 * type it is; the events of that policy are its configuration history, which a
 * resolver aggregates as its policy type prescribes.
 */
export type PolicyGroup = {
  /**
   * The on-chain access word of the tuple. Identifies the group, and is what the
   * API reports as a policy `id`.
   */
  access: Hex;
  /**
   * Newest event of the tuple: the one that bound the current policy. Source of
   * the policy address, its type and the guard.
   */
  latest: PolicyConfirmation;
  /**
   * Every event that configured the bound policy, oldest first, `latest`
   * included. Events of a policy that has since been replaced are not here.
   */
  confirmations: Array<PolicyConfirmation>;
};
