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
   * Every delayed configuration request the events report, newest first,
   * invalidated ones included.
   *
   * The caller filters by status: an invalidated request is history rather than
   * a pending change, but knowing that a root *was* requested is what tells a
   * cancelled request apart from one that was never requested at all.
   */
  getRootRequests(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyRootRequest>>;
}
