// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { fromSecondsTimestamp } from '#/domain/common/utils/time';
import type { ActiveRootsRule } from '#/modules/policies/domain/entities/active-roots-rule.entity';
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

/** The distinct guards holding a pending root of {@link roots}. */
export function pendingRootGuards(
  roots: ReadonlyArray<
    Pick<PolicyIndexerConfigurationRoot, 'guard' | 'status'>
  >,
): Array<Address> {
  return [
    ...new Set(
      roots
        .filter((root) => root.status === 'PENDING')
        .map((root) => root.guard),
    ),
  ];
}

/**
 * When a pending root can be applied, from `readyAt` until `readyAt + EXPIRY`.
 * `expiresAt` is `null` while `EXPIRY` is unknown; `null` for a root that is
 * not pending.
 */
export function applicationWindowOf(
  root: Pick<PolicyIndexerConfigurationRoot, 'guard' | 'status' | 'readyAt'>,
  expiry: number | undefined,
): { guard: Address; readyAt: number; expiresAt: number | null } | null {
  if (root.status !== 'PENDING') {
    return null;
  }

  return {
    guard: root.guard,
    readyAt: root.readyAt,
    expiresAt: expiry === undefined ? null : root.readyAt + expiry,
  };
}

/**
 * Whether {@link root} can still be applied: pending and not known to be past
 * `readyAt + EXPIRY`, as `SafePolicyGuard` checks it.
 */
export function isRootApplicable(
  root: Pick<PolicyIndexerConfigurationRoot, 'guard' | 'status' | 'readyAt'>,
  expiry: number | undefined,
  now: number,
): boolean {
  const window = applicationWindowOf(root, expiry);
  return (
    window !== null && (window.expiresAt === null || now < window.expiresAt)
  );
}

/**
 * Which stored roots count toward the cap: on-chain roots while applicable,
 * and drafts younger than {@link args.draftLifetime} (`DELAY + EXPIRY` of the
 * Safe's guard; `null` counts every draft).
 */
export function activeRootsRuleOf(args: {
  roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
  expiries: ReadonlyMap<Address, number>;
  draftLifetime: number | null;
  now: number;
}): ActiveRootsRule {
  return {
    onChain: new Map(
      args.roots.map((root) => [
        root.root,
        isRootApplicable(root, args.expiries.get(root.guard), args.now),
      ]),
    ),
    draftsSince:
      args.draftLifetime === null
        ? null
        : fromSecondsTimestamp(args.now - args.draftLifetime),
  };
}
