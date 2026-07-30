// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';

/**
 * A {@link PolicyGroup} over the given confirmations, which must be of one
 * `(target, selector, operation)` tuple and ordered oldest first - as
 * `policyGroups` returns them.
 *
 * Lets a resolver spec state its input as the events of an access without going
 * through the grouping pass, which has its own spec.
 */
export function policyGroupBuilder(
  confirmations: [PolicyConfirmation, ...Array<PolicyConfirmation>],
): PolicyGroup {
  return {
    access: accessSelector(confirmations[0]),
    latest: confirmations[confirmations.length - 1],
    confirmations,
  };
}
