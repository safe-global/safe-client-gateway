// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardEnforcedPolicy,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafePolicyGuardConfiguration } from '#/modules/policies/domain/entities/safe-policy-guard-configuration.entity';

/**
 * What the delayed guard items of a pending read are built from, read once for
 * every Safe of the request: the configuration roots the chain holds, the
 * configurations CGW stored for them, and the guard's current policy bindings.
 */
export type SafePolicyGuardConfigurationContext = {
  onChainConfigurations: ReadonlyArray<PolicyIndexerConfigurationRoot>;
  storedConfigurations: ReadonlyArray<SafePolicyGuardConfiguration>;
  guardEnforcedPolicies: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
};

/**
 * One pending read, as each Safe of it sees it.
 */
export type PendingRead = {
  types: ReadonlyArray<PolicyType>;
  spendingLimitsRequested: boolean;
  guardInstallationRequested: boolean;
  /** `null` when guard policies are not requested, or could not be read. */
  guardConfigurations: SafePolicyGuardConfigurationContext | null;
  /** Unix seconds, the same for every Safe of the read. */
  now: number;
};
