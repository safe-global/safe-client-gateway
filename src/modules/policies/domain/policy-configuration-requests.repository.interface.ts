// SPDX-License-Identifier: FSL-1.1-MIT
import type { PolicyConfigurationRequest } from '#/modules/policies/domain/entities/policy-configuration-request.entity';

export const IPolicyConfigurationRequestsRepository = Symbol(
  'IPolicyConfigurationRequestsRepository',
);

export interface IPolicyConfigurationRequestsRepository {
  /**
   * Stores the configurations of a request for a Safe in a Space, keyed by
   * root. Storing a stored root again is a no-op. The caller must have
   * verified that `root` is the hash of `configurations`.
   *
   * @throws {BadRequestException} if the Safe already holds the maximum number
   * of stored requests in the Space.
   */
  create(
    args: Omit<PolicyConfigurationRequest, 'id' | 'createdAt'>,
  ): Promise<void>;
}
