// SPDX-License-Identifier: FSL-1.1-MIT
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import type {
  ApplicationWindow,
  DelayedPolicyChange,
  QueuedApplyConfiguration,
} from '#/modules/policies/domain/entities/delayed-policy-change.entity';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  type PendingDelayedGuardPolicies,
  PendingDelayedGuardPoliciesStatus,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import { isFullySigned } from '#/modules/policies/domain/utils/queued-calls.utils';

/**
 * The indexer kinds CGW reports, and the policy type each is reported as.
 *
 * A kind absent here - `ERC20_APPROVE`, `ALLOWED_MODULE`, or the `UNKNOWN` of
 * an unregistered policy - is never requested from the indexer.
 */
const GUARD_POLICY_TYPE_BY_KIND = new Map<
  PolicyIndexerGuardPolicyKind,
  PolicyType
>([
  ['ERC20_TRANSFER', PolicyType.Erc20Transfer],
  ['COSIGNER', PolicyType.Cosigner],
  ['ALLOW', PolicyType.Allow],
  ['DENY', PolicyType.Deny],
  ['NATIVE_TRANSFER', PolicyType.NativeTransfer],
  ['MULTISEND', PolicyType.MultiSend],
]);

/** The policy types a `SafePolicyGuard` can enforce. */
export const GUARD_POLICY_TYPES: ReadonlyArray<PolicyType> = [
  ...GUARD_POLICY_TYPE_BY_KIND.values(),
];

/**
 * The indexer kinds to request for {@link types}. Empty when none of them is a
 * guard-enforced type.
 */
export function guardPolicyKindsOf(
  types: ReadonlyArray<PolicyType>,
): Array<PolicyIndexerGuardPolicyKind> {
  return [...GUARD_POLICY_TYPE_BY_KIND]
    .filter(([, type]) => types.includes(type))
    .map(([kind]) => kind);
}

/** The policy type {@link kind} is reported as, or `null` if CGW does not report it. */
export function guardPolicyTypeOfKind(
  kind: PolicyIndexerGuardPolicyKind,
): PolicyType | null {
  return GUARD_POLICY_TYPE_BY_KIND.get(kind) ?? null;
}

/** Whether {@link root} can still be applied: pending and before `expiresAt`. */
export function isRootApplicable(
  root: Pick<PolicyIndexerConfigurationRoot, 'status' | 'expiresAt'>,
  now: number,
): boolean {
  return root.status === 'PENDING' && now < root.expiresAt;
}

// --- Delayed guard configurations --------------------------------------------

/** The window of a root the chain holds as `PENDING`; `null` otherwise. */
export function applicationWindowOf(
  onChain: PolicyIndexerConfigurationRoot | null,
): ApplicationWindow | null {
  return onChain?.status === 'PENDING'
    ? {
        guard: onChain.guard,
        readyAt: onChain.readyAt,
        expiresAt: onChain.expiresAt,
      }
    : null;
}

/** The status of a queued apply whose window is open. */
export function queuedApplyStatus(
  apply: QueuedApplyConfiguration,
  window: ApplicationWindow,
  now: number,
): PendingDelayedGuardPolicies['status'] {
  if (!isFullySigned(apply.transaction)) {
    return PendingDelayedGuardPoliciesStatus.ApplicationInSigning;
  }
  // The guard rejects an apply before `readyAt`, however signed.
  return now < window.readyAt
    ? PendingDelayedGuardPoliciesStatus.PendingApplication
    : PendingDelayedGuardPoliciesStatus.ApplicationReady;
}

/**
 * When the change was first seen: CGW's draft, else its first queued call.
 * `null` for a root requested outside the wallet, which CGW has no record of.
 */
export function createdAtOf(change: DelayedPolicyChange): number | null {
  if (change.stored) {
    return toSecondsTimestamp(change.stored.createdAt);
  }
  return (
    change.queuedRequest?.transaction.proposedAt ??
    change.queuedApply?.transaction.proposedAt ??
    null
  );
}
