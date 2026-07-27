// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

/**
 * Whether a confirmation removes the policy for its access rather than setting
 * one. `PolicyConfirmed` is emitted for both; a zero policy address is a
 * removal.
 */
export function isRemoval(confirmation: PolicyConfirmation): boolean {
  return (
    confirmation.removed ||
    confirmation.policy.toLowerCase() === NULL_ADDRESS.toLowerCase()
  );
}

/**
 * Reduces the full event history to the latest confirmation per
 * `(target, selector, operation)`, newest first.
 *
 * Mirrors the Transaction Service's `PolicyConfirmation.objects.current()`.
 * Implemented here because the API exposes the raw event stream only.
 */
export function currentConfirmations(
  confirmations: ReadonlyArray<PolicyConfirmation>,
): Array<PolicyConfirmation> {
  const latestPerAccess = new Map<string, PolicyConfirmation>();

  for (const confirmation of confirmations) {
    const key = accessSelector(confirmation);
    const known = latestPerAccess.get(key);

    if (!known || isNewer(confirmation, known)) {
      latestPerAccess.set(key, confirmation);
    }
  }

  return [...latestPerAccess.values()].sort(
    (first, second) => -compareLogOrder(first, second),
  );
}

/**
 * The policies currently in effect: the latest confirmation per access, minus
 * the accesses whose latest confirmation is a removal.
 *
 * Mirrors the Transaction Service's `PolicyConfirmation.objects.active()`.
 */
export function activeConfirmations(
  confirmations: ReadonlyArray<PolicyConfirmation>,
): Array<PolicyConfirmation> {
  return currentConfirmations(confirmations).filter(
    (confirmation) => !isRemoval(confirmation),
  );
}

function isNewer(
  candidate: PolicyConfirmation,
  known: PolicyConfirmation,
): boolean {
  return compareLogOrder(candidate, known) > 0;
}

/**
 * Chain order of two logs: block number first, log index to break a tie within
 * a block.
 */
function compareLogOrder(
  first: PolicyConfirmation,
  second: PolicyConfirmation,
): number {
  if (first.blockNumber !== second.blockNumber) {
    return first.blockNumber - second.blockNumber;
  }
  return first.logIndex - second.logIndex;
}
