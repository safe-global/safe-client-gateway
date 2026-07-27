// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The static part of a catalogue entry: what the wallet renders before any
 * chain or Safe is taken into account.
 */
export type PolicyCatalogueEntry = {
  type: PolicyType;
  title: string;
  description: string;
  enforcementKind: PolicyEnforcementKind;
};

/**
 * A policy type the wallet can offer for a Safe on a chain.
 *
 * `enforcement` is `null` when the policy is not available on the chain, since
 * there are then no deployment addresses to report.
 */
export type AvailablePolicy = Omit<PolicyCatalogueEntry, 'enforcementKind'> & {
  available: boolean;
  configuredCount: number;
  enforcement: PolicyEnforcement | null;
};
