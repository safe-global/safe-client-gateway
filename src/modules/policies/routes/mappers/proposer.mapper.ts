// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type {
  ActivePolicy,
  ProposerPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { DelegateApiVersion } from '@/modules/policies/domain/entities/delegate-api-version.entity';
import {
  OffChainSource,
  offChainEnforcement,
} from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

/** One delegates API's answer for one Safe. */
export type DelegatesOfVersion = {
  version: DelegateApiVersion;
  delegates: ReadonlyArray<Delegate>;
};

/**
 * Builds the `proposer` policies of one Safe from the delegate registrations
 * the Transaction Service holds.
 *
 * A delegate may propose a transaction but cannot sign or execute one, so
 * nothing on chain enforces the grant - it is access, reported as `offchain`.
 */
@Injectable()
export class ProposerMapper {
  /**
   * One policy per delegates API that returned a registration.
   *
   * The two APIs are independent stores and are never merged: a client revokes
   * a grant through the API holding it, so collapsing them would hide which one
   * that is. While the Queue Service is switched off both APIs read the same
   * upstream and report the same proposers twice, once per version.
   */
  public map(args: {
    safe: SafeRef;
    /** Each delegates API's rows, already scoped to {@link args.safe}. */
    delegatesByVersion: ReadonlyArray<DelegatesOfVersion>;
  }): Array<ActivePolicy> {
    const proposerPolicies: Array<ActivePolicy> = [];

    for (const { version, delegates } of args.delegatesByVersion) {
      // No registrations is no policy, rather than a policy granting nobody.
      if (delegates.length === 0) {
        continue;
      }

      proposerPolicies.push({
        type: PolicyType.Proposer,
        enforcement: offChainEnforcement(OffChainSource.Delegates),
        // A registered delegate may propose from the moment it is registered:
        // there is no on-chain switch that could leave it configured but unused.
        enabled: true,
        data: { version, proposers: this.toProposers(delegates) },
        safe: args.safe,
      });
    }

    return proposerPolicies;
  }

  /**
   * One entry per address allowed to propose, with every owner that granted it
   * nested inside.
   *
   * The Transaction Service serves one row per `(delegate, delegator)`, so an
   * address granted by two owners arrives twice.
   */
  private toProposers(
    delegates: ReadonlyArray<Delegate>,
  ): ProposerPolicyData['proposers'] {
    const grantsByProposer = this.groupByDelegate(delegates);

    const proposers: ProposerPolicyData['proposers'] = [];

    for (const [proposer, grants] of grantsByProposer) {
      proposers.push({
        proposer,
        delegatedBy: grants.map((grant) => ({
          delegator: grant.delegator,
          label: grant.label,
        })),
      });
    }

    return proposers;
  }

  /**
   * The registrations of each address allowed to propose.
   *
   * Keys are checksummed, as the Transaction Service serves them. First-seen
   * order is preserved so its ordering survives into the response.
   */
  private groupByDelegate(
    delegates: ReadonlyArray<Delegate>,
  ): Map<Address, Array<Delegate>> {
    const grouped = new Map<Address, Array<Delegate>>();

    for (const delegate of delegates) {
      const group = grouped.get(delegate.delegate) ?? [];
      group.push(delegate);
      grouped.set(delegate.delegate, group);
    }

    return grouped;
  }
}
