// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type {
  ActivePolicy,
  ProposerPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import { OffChainSource } from '@/modules/policies/domain/entities/policy-enforcement.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';

const SEPOLIA = '11155111';

/**
 * The proposer configuration of {@link policy}.
 *
 * `ActivePolicy.data` is a union across policy types and the discriminating
 * `type` sits on the policy rather than on the data, so the shape is narrowed
 * here by the field only a proposer policy carries.
 */
function proposerData(policy: ActivePolicy): ProposerPolicyData {
  if (!('proposers' in policy.data)) {
    throw new Error(`Expected a proposer policy, got ${policy.type}`);
  }

  return policy.data;
}

describe('ProposerMapper', () => {
  let target: ProposerMapper;
  const safe: SafeRef = {
    chainId: SEPOLIA,
    address: getAddress(faker.finance.ethereumAddress()),
  };

  beforeEach(() => {
    target = new ProposerMapper();
  });

  /** A delegate registration on `safe`. */
  function delegate(): IBuilder<Delegate> {
    return delegateBuilder().with('safe', safe.address);
  }

  /** The policies built from the delegates API's rows. */
  function map(delegates: Array<Delegate>): Array<ActivePolicy> {
    return target.map({ safe, delegates });
  }

  describe('one policy per safe', () => {
    it('should report no policy when no registration is held', () => {
      const policies = map([]);

      expect(policies).toStrictEqual([]);
    });

    it('should report one policy holding every registration', () => {
      const first = delegate().build();
      const second = delegate().build();

      const policies = map([first, second]);

      expect(policies).toHaveLength(1);
      expect(proposerData(policies[0]).proposers).toStrictEqual([
        {
          proposer: first.delegate,
          delegatedBy: [{ delegator: first.delegator, label: first.label }],
        },
        {
          proposer: second.delegate,
          delegatedBy: [{ delegator: second.delegator, label: second.label }],
        },
      ]);
    });
  });

  describe('the policy envelope', () => {
    it('should report the grant as enforced off chain by the delegates store', () => {
      const [policy] = map([delegate().build()]);

      expect(policy).toMatchObject({
        type: PolicyType.Proposer,
        enforcement: {
          via: PolicyEnforcementKind.OffChain,
          source: OffChainSource.Delegates,
        },
        safe,
      });
    });

    it('should report a registered proposer as enabled', () => {
      // Nothing on chain gates a proposer, so there is no configured-but-
      // unenforced state to report.
      const [policy] = map([delegate().build()]);

      expect(policy.enabled).toBe(true);
    });
  });

  describe('nesting the registrations by proposer', () => {
    it('should collapse one proposer granted by two owners into one entry', () => {
      const proposer = getAddress(faker.finance.ethereumAddress());
      const byFirst = delegate().with('delegate', proposer).build();
      const bySecond = delegate().with('delegate', proposer).build();

      const [policy] = map([byFirst, bySecond]);

      expect(proposerData(policy).proposers).toStrictEqual([
        {
          proposer,
          delegatedBy: [
            { delegator: byFirst.delegator, label: byFirst.label },
            { delegator: bySecond.delegator, label: bySecond.label },
          ],
        },
      ]);
    });

    it('should keep each owner’s own label for the same proposer', () => {
      // The Transaction Service stores the label per (delegate, delegator)
      // row, so two owners can label one proposer differently.
      const proposer = getAddress(faker.finance.ethereumAddress());
      const byFirst = delegate()
        .with('delegate', proposer)
        .with('label', 'Ops bot')
        .build();
      const bySecond = delegate()
        .with('delegate', proposer)
        .with('label', 'Finance')
        .build();

      const [policy] = map([byFirst, bySecond]);

      expect(
        proposerData(policy).proposers[0].delegatedBy.map(
          (grant) => grant.label,
        ),
      ).toStrictEqual(['Ops bot', 'Finance']);
    });

    it('should keep two proposers apart, in the order served', () => {
      const first = delegate().build();
      const second = delegate().build();

      const [policy] = map([first, second]);

      expect(
        proposerData(policy).proposers.map((entry) => entry.proposer),
      ).toStrictEqual([first.delegate, second.delegate]);
    });

    it('should carry an unlabelled grant as an empty label', () => {
      // The Queue Service allows a null label; the repository coerces it to ''
      // so both backends represent "no label" identically.
      const unlabelled = delegate().with('label', '').build();

      const [policy] = map([unlabelled]);

      expect(proposerData(policy).proposers[0].delegatedBy).toStrictEqual([
        { delegator: unlabelled.delegator, label: '' },
      ]);
    });
  });
});
