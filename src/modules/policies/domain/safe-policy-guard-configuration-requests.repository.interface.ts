// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { PolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';

export const ISafePolicyGuardConfigurationRequestsRepository = Symbol(
  'ISafePolicyGuardConfigurationRequestsRepository',
);

/** On-chain roots mapped to whether they still count; any other stored root counts. */
export type ActiveRootsRule = ReadonlyMap<Hex, boolean>;

/** Counts every stored root. */
export const EVERY_ROOT_ACTIVE: ActiveRootsRule = new Map();

export interface ISafePolicyGuardConfigurationRequestsRepository {
  /**
   * Stores the configurations of a request for a Safe in a Space, keyed by
   * root. Storing a stored root again is a no-op. The caller must have
   * verified that `root` is the hash of `configurations`.
   *
   * @throws {BadRequestException} if the Safe already holds the maximum number
   * of active requests in the Space, per {@link activeRoots} (every stored
   * root by default).
   */
  create(
    args: Omit<PolicyConfigurationRequest, 'id' | 'createdAt'>,
    activeRoots?: ActiveRootsRule,
  ): Promise<void>;
}
