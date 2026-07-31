// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyEnforcement } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import type {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The static part of a catalogue entry: what the wallet renders before any
 * chain or Safe is taken into account.
 *
 * `available` lives here rather than being derived per chain: whether the
 * product offers a policy type is a release-time decision, not a function of
 * which addresses CGW happens to know. A type with no known deployment is still
 * offered, with a `null` enforcement.
 */
export type PolicyCatalogueEntry = {
  type: PolicyType;
  title: string;
  description: string;
  enforcementKind: PolicyEnforcementKind;
  available: boolean;
  /**
   * Whether the policy binds the fallback access - the access word with `target`
   * and `selector` zeroed, which covers every call no other policy matches.
   */
  isFallback: boolean;
};

/**
 * A policy type the wallet can offer for a Safe on a chain.
 *
 * `enforcement` is `null` when CGW knows no deployment for the type on the
 * chain: the type is still offered, but the wallet has no address to configure
 * it with.
 */
export type AvailablePolicy = Omit<PolicyCatalogueEntry, 'enforcementKind'> & {
  enforcement: PolicyEnforcement | null;
};
