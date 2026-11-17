// SPDX-License-Identifier: FSL-1.1-MIT
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import type { Caip10Address } from '#/validation/entities/schemas/caip-10-addresses.schema';

/** A read of the active or pending policies of a Space's Safes. */
export type SpacePolicyRequest = {
  spaceId: Space['id'];
  /** Narrows the read to a subset of the Space's Safes. */
  safes?: ReadonlyArray<Caip10Address>;
  /** The policy types to report. Required: naming none asks for nothing. */
  types: ReadonlyArray<PolicyType>;
  authPayload: AuthPayload;
};

/** A read of the pending policies of a Space's Safes. */
export type SpacePendingPolicyRequest = SpacePolicyRequest & {
  /**
   * Also report the queued `setGuard` and `setModuleGuard` calls that install
   * a `SafePolicyGuard`. The guard is not a policy, so no entry of `types`
   * implies them.
   */
  includeGuardInstallation?: boolean;
};
