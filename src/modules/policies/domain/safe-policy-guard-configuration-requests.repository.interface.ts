// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { PolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { StoredPolicyConfiguration } from '#/modules/policies/domain/entities/stored-policy-configuration.entity';

/** Which stored roots still count toward the per-Space, per-Safe cap. */
export type ActiveRootsRule = {
  /** Roots known on-chain, mapped to whether they can still be applied. */
  onChain: ReadonlyMap<Hex, boolean>;
  /** Drafts created before this no longer count; `null` counts every draft. */
  draftsSince: Date | null;
};

/** Counts every stored root. */
export const EVERY_ROOT_ACTIVE: ActiveRootsRule = {
  onChain: new Map(),
  draftsSince: null,
};

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
    activeRoots?: ActiveRootsRule,
  ): Promise<void>;

  /** The configurations stored for {@link args.safes} in one Space, oldest first. */
  findBySafes(args: {
    spaceId: number;
    safes: ReadonlyArray<SafeRef>;
  }): Promise<Array<StoredPolicyConfiguration>>;
}
