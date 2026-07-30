// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import type { PolicyRootRequest } from '@/modules/policies/domain/entities/policy-root-request.entity';

export const IPoliciesRepository = Symbol('IPoliciesRepository');

export interface IPoliciesRepository {
  /**
   * The `PolicyConfirmed` stream of the Safe, reduced to one {@link PolicyGroup}
   * per access that currently has a policy, newest access first.
   *
   * Note: "has a policy" is not "enforced" - a policy can be configured before
   * the guard is enabled on the Safe. Resolving that is the caller's job, which
   * has the Safe at hand.
   */
  getPolicyGroups(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyGroup>>;

  /**
   * Delayed configuration requests that have neither been invalidated nor
   * (as far as the events show) superseded, newest first.
   */
  getOpenRootRequests(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyRootRequest>>;
}
