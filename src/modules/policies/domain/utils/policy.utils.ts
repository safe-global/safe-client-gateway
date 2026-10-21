// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';

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
