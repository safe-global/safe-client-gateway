// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyCatalogueEntry } from '@/modules/policies/domain/entities/available-policy.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The policy types the wallet can offer, with their product copy.
 *
 * Static on purpose: the copy ships with a release, and so does `available` -
 * whether a type is offered is a product decision, not a function of which
 * addresses CGW knows. The per-chain part is `enforcement`, derived from the
 * deployments (see `PolicyDeploymentsService`).
 *
 * Adding a type means adding an entry here; a *resolver* is only needed for
 * `/policies/active` to render the type once it is configured.
 *
 * The fallback entries come last: the specific policies are what a wallet
 * offers first, the catch-alls qualify them.
 */
export const POLICY_CATALOGUE: ReadonlyArray<PolicyCatalogueEntry> = [
  {
    type: PolicyType.SpendingLimit,
    title: 'Spending limit',
    description: 'Let a spender withdraw up to a fixed amount per token.',
    enforcementKind: PolicyEnforcementKind.Module,
    available: true,
    isFallback: false,
  },
  {
    type: PolicyType.Recovery,
    title: 'Account recovery',
    description: 'Nominate a recoverer who can recover the Safe after a delay.',
    enforcementKind: PolicyEnforcementKind.Module,
    available: true,
    isFallback: false,
  },
  {
    type: PolicyType.Erc20Transfer,
    title: 'Token withdraw allowlist',
    description: 'Restrict, per token, which addresses the Safe can send to.',
    enforcementKind: PolicyEnforcementKind.Guard,
    available: true,
    isFallback: false,
  },
  {
    type: PolicyType.Cosigner,
    title: 'Cosigner',
    description:
      'Require a cosigner when a token transfer exceeds a threshold.',
    enforcementKind: PolicyEnforcementKind.Guard,
    available: true,
    isFallback: false,
  },
  {
    type: PolicyType.AllowPolicy,
    title: 'Allow by default',
    description: 'Permit any call the Safe makes that no other policy covers.',
    enforcementKind: PolicyEnforcementKind.Guard,
    available: true,
    isFallback: true,
  },
  {
    type: PolicyType.NativeTransfer,
    title: 'Native transfers',
    description:
      'Govern plain value transfers, which carry no function selector.',
    enforcementKind: PolicyEnforcementKind.Guard,
    available: true,
    isFallback: true,
  },
  {
    type: PolicyType.Deny,
    title: 'Deny by default',
    description: 'Block any call the Safe makes that no other policy covers.',
    enforcementKind: PolicyEnforcementKind.Guard,
    available: true,
    isFallback: true,
  },
];
