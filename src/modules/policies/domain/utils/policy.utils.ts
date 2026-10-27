// SPDX-License-Identifier: FSL-1.1-MIT
import { isAddressEqual, zeroAddress } from 'viem';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import type {
  ApplicationWindow,
  DelayedPolicyChange,
  QueuedApplyConfiguration,
} from '#/modules/policies/domain/entities/delayed-policy-change.entity';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardEnforcedPolicy,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  type PendingDelayedGuardPolicies,
  PendingDelayedGuardPoliciesStatus,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import { policyOperationFromValue } from '#/modules/policies/domain/entities/policy-operation.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import { getPolicyTypeOfContract } from '#/modules/policies/domain/policy-deployments.constants';
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

/**
 * Whether {@link args.configurations} may set a requested policy type.
 *
 * `false` only when CGW knows the type of every configuration and none was
 * requested. A configuration of an unknown type - an unknown policy contract,
 * or a removal of no known binding - cannot be ruled out, so it keeps them in.
 */
export function maySetRequestedType(args: {
  chainId: string;
  configurations: ReadonlyArray<PolicyConfiguration>;
  guardEnforcedPolicies: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
  types: ReadonlyArray<PolicyType>;
}): boolean {
  return args.configurations.some((configuration) => {
    const type = policyTypeOf({
      chainId: args.chainId,
      configuration,
      guardEnforcedPolicies: args.guardEnforcedPolicies,
    });
    return type === null || args.types.includes(type);
  });
}

/**
 * The policy type a configuration sets. A configuration that removes a policy
 * names no policy contract, so its type is that of the binding it removes.
 */
function policyTypeOf(args: {
  chainId: string;
  configuration: PolicyConfiguration;
  guardEnforcedPolicies: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
}): PolicyType | null {
  const { configuration } = args;

  if (!isAddressEqual(configuration.policy, zeroAddress)) {
    return getPolicyTypeOfContract(args.chainId, configuration.policy);
  }

  const operation = policyOperationFromValue(configuration.operation);
  const guardEnforcedPolicy = args.guardEnforcedPolicies.find(
    (guardEnforcedPolicy) =>
      isAddressEqual(guardEnforcedPolicy.target, configuration.target) &&
      guardEnforcedPolicy.selector.toLowerCase() ===
        configuration.selector.toLowerCase() &&
      guardEnforcedPolicy.operation === operation,
  );

  return guardEnforcedPolicy
    ? guardPolicyTypeOfKind(guardEnforcedPolicy.kind)
    : null;
}

/**
 * Whether {@link root} can still be applied: pending and before `expiresAt`.
 * An `expiresAt` of 0 means the expiry is unknown, so it is not expired.
 */
export function isRootApplicable(
  root: Pick<PolicyIndexerConfigurationRoot, 'status' | 'expiresAt'>,
  now: number,
): boolean {
  return (
    root.status === 'PENDING' && (root.expiresAt === 0 || now < root.expiresAt)
  );
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
