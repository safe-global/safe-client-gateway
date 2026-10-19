// SPDX-License-Identifier: FSL-1.1-MIT
import type { ActiveRootsRule } from '#/modules/policies/domain/entities/active-roots-rule.entity';
import type { PolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { StoredPolicyConfiguration } from '#/modules/policies/domain/entities/stored-policy-configuration.entity';

export const ISafePolicyGuardConfigurationRequestsRepository = Symbol(
  'ISafePolicyGuardConfigurationRequestsRepository',
);

export interface ISafePolicyGuardConfigurationRequestsRepository {
  /**
   * Stores the configurations of a request for a Safe in a Space, keyed by
   * root. Storing a stored root again is a no-op. The caller must have
   * verified that `root` is the hash of `configurations`.
   *
   * @throws {BadRequestException} if the Safe already holds the maximum number
   * of active requests in the Space, per {@link activeRoots}.
   */
  create(
    args: Omit<PolicyConfigurationRequest, 'id' | 'createdAt'>,
    activeRoots: ActiveRootsRule,
  ): Promise<void>;

  /** The configurations stored for {@link args.safes} in one Space, oldest first. */
  findBySafes(args: {
    spaceId: number;
    safes: ReadonlyArray<SafeRef>;
  }): Promise<Array<StoredPolicyConfiguration>>;
}
