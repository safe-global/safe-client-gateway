// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';
import { NULL_ADDRESS } from '@/routes/common/constants';

/**
 * Whether a confirmation removes the policy of its access rather than setting
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
 * Turns the raw `PolicyConfirmed` stream of a Safe into one {@link PolicyGroup}
 * per access that currently has a policy, newest access first.
 *
 * The whole reduction lives here, in three steps per
 * `(target, selector, operation)` tuple:
 *
 * 1. the tuple's events are ordered by chain position, and the newest one wins:
 *    the guard stores a single policy per access, so that event is the bound
 *    policy - and its type;
 * 2. a tuple whose newest event is a removal has no policy and is dropped;
 * 3. the remaining events are filtered to those of the bound policy. Events of a
 *    policy that has since been replaced describe another contract's storage, so
 *    a tuple only ever yields events of one policy - and one policy type.
 *
 * What the surviving events *mean* is left to the resolver of that type, because
 * only it knows whether its `data` accumulates (`ERC20TransferPolicy` upserts
 * recipients, so a three-transaction allowlist needs all three events) or is
 * replaced (`CoSignerPolicy` sets one cosigner, so only the newest counts).
 */
export function policyGroups(
  confirmations: ReadonlyArray<PolicyConfirmation>,
): Array<PolicyGroup> {
  const groups: Array<PolicyGroup> = [];

  for (const [access, tuple] of groupByAccess(confirmations)) {
    const ordered = [...tuple].sort(compareLogOrder);
    const latest = ordered[ordered.length - 1];

    if (isRemoval(latest)) {
      continue;
    }

    groups.push({
      access,
      latest,
      confirmations: ordered.filter((confirmation) =>
        isSamePolicy(confirmation, latest),
      ),
    });
  }

  return groups.sort(
    (first, second) => -compareLogOrder(first.latest, second.latest),
  );
}

/**
 * The events of each access, keyed by its access word.
 *
 * A log is unique by `(transactionHash, logIndex)`, but the history is read over
 * several offset-paginated requests, so an event indexed between two of them can
 * shift the window and repeat a row. Repeats are dropped here: folding a
 * cumulative payload twice would count it twice.
 */
function groupByAccess(
  confirmations: ReadonlyArray<PolicyConfirmation>,
): Map<Hex, Array<PolicyConfirmation>> {
  const seenLogs = new Set<string>();
  const perAccess = new Map<Hex, Array<PolicyConfirmation>>();

  for (const confirmation of confirmations) {
    const log = `${confirmation.transactionHash}_${confirmation.logIndex}`;

    if (seenLogs.has(log)) {
      continue;
    }
    seenLogs.add(log);

    const access = accessSelector(confirmation);
    perAccess.set(access, [...(perAccess.get(access) ?? []), confirmation]);
  }

  return perAccess;
}

/**
 * Whether two events configured the same policy contract. Equal addresses imply
 * an equal policy type; a redeployment of the same type is a different contract
 * with its own storage, so it does not continue the previous one's history.
 */
function isSamePolicy(
  confirmation: PolicyConfirmation,
  other: PolicyConfirmation,
): boolean {
  return confirmation.policy.toLowerCase() === other.policy.toLowerCase();
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
