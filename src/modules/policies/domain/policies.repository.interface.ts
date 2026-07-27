// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import type { PolicyRootRequest } from '@/modules/policies/domain/entities/policy-root-request.entity';

export const IPoliciesRepository = Symbol('IPoliciesRepository');

export interface IPoliciesRepository {
  /**
   * The policies currently set on the Safe: the latest `PolicyConfirmed` event
   * per `(target, selector, operation)`, removals excluded.
   *
   * Note: "set" is not "enforced" - a policy can be configured before the guard
   * is enabled on the Safe. Resolving that is the caller's job, which has the
   * Safe at hand.
   */
  getActiveConfirmations(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyConfirmation>>;

  /**
   * Delayed configuration requests that have neither been invalidated nor
   * (as far as the events show) superseded, newest first.
   */
  getOpenRootRequests(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyRootRequest>>;
}
