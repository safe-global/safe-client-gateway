// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type {
  ActivePolicy,
  ProposerPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import {
  OffChainSource,
  offChainEnforcement,
} from '@/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';

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
   * The one `proposer` policy of a Safe, or none when nothing is registered.
   */
  public map(args: {
    safe: SafeRef;
    /** The delegate registrations, already scoped to {@link args.safe}. */
    delegates: ReadonlyArray<Delegate>;
  }): Array<ActivePolicy> {
    // No registrations is no policy, rather than a policy granting nobody.
    if (args.delegates.length === 0) {
      return [];
    }

    return [
      {
        type: PolicyType.Proposer,
        enforcement: offChainEnforcement(OffChainSource.Delegates),
        // A registered delegate may propose from the moment it is registered:
        // there is no on-chain switch that could leave it configured but unused.
        enabled: true,
        data: { proposers: this.toProposers(args.delegates) },
        safe: args.safe,
      },
    ];
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
