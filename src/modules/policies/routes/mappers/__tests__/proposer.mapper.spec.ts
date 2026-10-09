// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
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
      const first = delegateBuilder().with('safe', safe.address).build();
      const second = delegateBuilder().with('safe', safe.address).build();

      const policies = map([first, second]);

      expect(policies).toHaveLength(1);
      expect(proposerData(policies[0]).proposers).toStrictEqual([
        {
          proposer: first.delegate,
          delegatedBy: [
            {
              delegator: first.delegator,
              label: first.label,
              created: first.created,
              modified: first.modified,
            },
          ],
        },
        {
          proposer: second.delegate,
          delegatedBy: [
            {
              delegator: second.delegator,
              label: second.label,
              created: second.created,
              modified: second.modified,
            },
          ],
        },
      ]);
    });
  });

  describe('the policy envelope', () => {
    it('should report the grant as enforced off chain by the delegates store', () => {
      const [policy] = map([
        delegateBuilder().with('safe', safe.address).build(),
      ]);

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
      const [policy] = map([
        delegateBuilder().with('safe', safe.address).build(),
      ]);

      expect(policy.enabled).toBe(true);
    });
  });

  describe('nesting the registrations by proposer', () => {
    it('should collapse one proposer granted by two owners into one entry', () => {
      // Each owner's grant keeps its own timestamps - a grant must never
      // report another grant's dates, e.g. by indexing the first grant of
      // the group instead of the one being mapped.
      const proposer = getAddress(faker.finance.ethereumAddress());
      const byFirst = delegateBuilder()
        .with('safe', safe.address)
        .with('delegate', proposer)
        .with('created', faker.date.past())
        .with('modified', faker.date.recent())
        .build();
      const bySecond = delegateBuilder()
        .with('safe', safe.address)
        .with('delegate', proposer)
        .with('created', faker.date.past())
        .with('modified', faker.date.recent())
        .build();

      const [policy] = map([byFirst, bySecond]);

      expect(proposerData(policy).proposers).toStrictEqual([
        {
          proposer,
          delegatedBy: [
            {
              delegator: byFirst.delegator,
              label: byFirst.label,
              created: byFirst.created,
              modified: byFirst.modified,
            },
            {
              delegator: bySecond.delegator,
              label: bySecond.label,
              created: bySecond.created,
              modified: bySecond.modified,
            },
          ],
        },
      ]);
    });

    it('should keep each owner’s own label for the same proposer', () => {
      // The Transaction Service stores the label per (delegate, delegator)
      // row, so two owners can label one proposer differently.
      const proposer = getAddress(faker.finance.ethereumAddress());
      const byFirst = delegateBuilder()
        .with('safe', safe.address)
        .with('delegate', proposer)
        .with('label', 'Ops bot')
        .build();
      const bySecond = delegateBuilder()
        .with('safe', safe.address)
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
      const first = delegateBuilder().with('safe', safe.address).build();
      const second = delegateBuilder().with('safe', safe.address).build();

      const [policy] = map([first, second]);

      expect(
        proposerData(policy).proposers.map((entry) => entry.proposer),
      ).toStrictEqual([first.delegate, second.delegate]);
    });

    it('should carry an unlabelled grant as an empty label', () => {
      // The Queue Service allows a null label; the repository coerces it to ''
      // so both backends represent "no label" identically.
      const unlabelled = delegateBuilder()
        .with('safe', safe.address)
        .with('label', '')
        .build();

      const [policy] = map([unlabelled]);

      expect(proposerData(policy).proposers[0].delegatedBy).toStrictEqual([
        {
          delegator: unlabelled.delegator,
          label: '',
          created: unlabelled.created,
          modified: unlabelled.modified,
        },
      ]);
    });
  });

  describe('grant timestamps', () => {
    it('should report null timestamps for a registration held by the Transaction Service', () => {
      const delegate = delegateBuilder().with('safe', safe.address).build();

      const [policy] = map([delegate]);

      const [grant] = proposerData(policy).proposers[0].delegatedBy;
      expect(grant.created).toBeNull();
      expect(grant.modified).toBeNull();
    });

    it('should carry the Queue Service’s timestamps through for its registrations', () => {
      const created = faker.date.past();
      const modified = faker.date.recent();
      const delegate = delegateBuilder()
        .with('safe', safe.address)
        .with('created', created)
        .with('modified', modified)
        .build();

      const [policy] = map([delegate]);

      const [grant] = proposerData(policy).proposers[0].delegatedBy;
      expect(grant.created).toBe(created);
      expect(grant.modified).toBe(modified);
    });
  });
});
