// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyCatalogueEntry } from '@/modules/policies/domain/entities/available-policy.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * Chain feature flag acting as the kill switch for the policies feature. When
 * absent from a chain's features, every catalogue entry is reported as
 * unavailable and no policies are resolved for that chain.
 */
export const FF_POLICIES = 'POLICIES';

/**
 * The policy types the wallet can offer, with their product copy.
 *
 * Static on purpose: the copy ships with a release, and per-chain availability
 * is derived from the deployments (see `PolicyDeploymentsService`). Adding a
 * type means adding an entry here plus - for a guard-enforced type - a resolver.
 */
export const POLICY_CATALOGUE: ReadonlyArray<PolicyCatalogueEntry> = [
  {
    type: PolicyType.SpendingLimit,
    title: 'Spending limit',
    description: 'Let a spender withdraw up to a fixed amount per token.',
    enforcementKind: PolicyEnforcementKind.Module,
  },
  {
    type: PolicyType.Recovery,
    title: 'Account recovery',
    description: 'Nominate a recoverer who can recover the Safe after a delay.',
    enforcementKind: PolicyEnforcementKind.Module,
  },
  {
    type: PolicyType.Erc20Transfer,
    title: 'Token withdraw allowlist',
    description: 'Restrict, per token, which addresses the Safe can send to.',
    enforcementKind: PolicyEnforcementKind.Guard,
  },
  {
    type: PolicyType.Cosigner,
    title: 'Cosigner',
    description:
      'Require a cosigner when a token transfer exceeds a threshold.',
    enforcementKind: PolicyEnforcementKind.Guard,
  },
];
