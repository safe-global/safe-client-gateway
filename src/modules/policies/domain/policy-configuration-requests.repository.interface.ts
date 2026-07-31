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
   * Every stored request of a Safe, newest first.
   *
   * Not scoped to a space: a root requested on-chain is public, and which space
   * it was stored through must not decide whether CGW can explain it. Rows the
   * chain does not know about are the caller's to scope - see `spaceId`.
   *
   * Bounded by the per-Safe cap, so this is a small read.
   */
  findBySafe(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyConfigurationRequest>>;
}
