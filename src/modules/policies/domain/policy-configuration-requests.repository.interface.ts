// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';

export const IPolicyConfigurationRequestsRepository = Symbol(
  'IPolicyConfigurationRequestsRepository',
);

export interface IPolicyConfigurationRequestsRepository {
  /**
   * Stores the configurations of a request, keyed by `(chainId, safeAddress,
   * root)`.
   *
   * Idempotent: storing the same root again is a no-op, so a retrying client
   * cannot create duplicates. The caller is responsible for having verified that
   * `root` is the hash of `configurations` and that the Safe requested it.
   *
   * @throws {BadRequestException} if the Safe already holds the maximum number
   * of stored requests.
   */
  create(args: {
    chainId: string;
    safeAddress: Address;
    root: Hex;
    configurations: ReadonlyArray<PolicyConfiguration>;
    spaceId: number;
    createdBy: number;
  }): Promise<void>;

  /**
   * The stored requests of a Safe among {@link roots}, for explaining pending
   * requests. Returns only the roots that are stored, so a caller learns which
   * ones it cannot explain.
   */
  findByRoots(args: {
    chainId: string;
    safeAddress: Address;
    roots: ReadonlyArray<Hex>;
  }): Promise<Array<PolicyConfigurationRequest>>;
}
