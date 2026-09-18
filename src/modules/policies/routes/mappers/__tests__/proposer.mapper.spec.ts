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
import { DelegateApiVersion } from '@/modules/policies/domain/entities/delegate-api-version.entity';
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
 * `ActivePolicy.data` is a union across policy types, and the discriminating
 * `type` sits on the policy rather than on the data, so it cannot be narrowed
 * structurally - `StatelessPolicyData` is `Record<string, never>` and answers to
 * every `in` check. Every policy this mapper builds is a proposer policy.
 */
function proposerData(policy: ActivePolicy): ProposerPolicyData {
  return policy.data as ProposerPolicyData;
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

  /** The policies built from one version's rows, the other returning nothing. */
  function mapV2(delegates: Array<Delegate>): Array<ActivePolicy> {
    return target.map({
      safe,
      delegatesByVersion: [
        { version: DelegateApiVersion.V2, delegates },
        { version: DelegateApiVersion.V3, delegates: [] },
      ],
    });
  }

  describe('one policy per delegates API', () => {
    it('should report no policy when neither API holds a registration', () => {
      const policies = target.map({
        safe,
        delegatesByVersion: [
          { version: DelegateApiVersion.V2, delegates: [] },
          { version: DelegateApiVersion.V3, delegates: [] },
        ],
      });

      expect(policies).toStrictEqual([]);
    });

    it('should report only the version that holds a registration', () => {
      const policies = mapV2([delegate().build()]);

      expect(policies).toHaveLength(1);
      expect(proposerData(policies[0]).version).toBe(DelegateApiVersion.V2);
    });

    it('should report each version separately, keeping its own proposers', () => {
      const onV2 = delegate().build();
      const onV3 = delegate().build();

      const policies = target.map({
        safe,
        delegatesByVersion: [
          { version: DelegateApiVersion.V2, delegates: [onV2] },
          { version: DelegateApiVersion.V3, delegates: [onV3] },
        ],
      });

      expect(policies).toHaveLength(2);
      expect(proposerData(policies[0])).toMatchObject({
        version: DelegateApiVersion.V2,
        proposers: [{ proposer: onV2.delegate }],
      });
      expect(proposerData(policies[1])).toMatchObject({
        version: DelegateApiVersion.V3,
        proposers: [{ proposer: onV3.delegate }],
      });
    });

    it('should not collapse the same grant held by both APIs', () => {
      // While the Queue Service is off both APIs read the same upstream, so the
      // same proposer arrives twice. It is reported once per version rather
      // than merged: a client revokes a grant through the API holding it.
      const shared = delegate().build();

      const policies = target.map({
        safe,
        delegatesByVersion: [
          { version: DelegateApiVersion.V2, delegates: [shared] },
          { version: DelegateApiVersion.V3, delegates: [shared] },
        ],
      });

      expect(policies).toHaveLength(2);
      expect(proposerData(policies[0]).proposers).toStrictEqual(
        proposerData(policies[1]).proposers,
      );
      expect(proposerData(policies[0]).version).toBe(DelegateApiVersion.V2);
      expect(proposerData(policies[1]).version).toBe(DelegateApiVersion.V3);
    });
  });

  describe('the policy envelope', () => {
    it('should report the grant as enforced off chain by the delegates store', () => {
      const [policy] = mapV2([delegate().build()]);

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
      const [policy] = mapV2([delegate().build()]);

      expect(policy.enabled).toBe(true);
    });
  });

  describe('nesting the registrations by proposer', () => {
    it('should collapse one proposer granted by two owners into one entry', () => {
      const proposer = getAddress(faker.finance.ethereumAddress());
      const byFirst = delegate().with('delegate', proposer).build();
      const bySecond = delegate().with('delegate', proposer).build();

      const [policy] = mapV2([byFirst, bySecond]);

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

      const [policy] = mapV2([byFirst, bySecond]);

      expect(
        proposerData(policy).proposers[0].delegatedBy.map(
          (grant) => grant.label,
        ),
      ).toStrictEqual(['Ops bot', 'Finance']);
    });

    it('should keep two proposers apart, in the order served', () => {
      const first = delegate().build();
      const second = delegate().build();

      const [policy] = mapV2([first, second]);

      expect(
        proposerData(policy).proposers.map((entry) => entry.proposer),
      ).toStrictEqual([first.delegate, second.delegate]);
    });

    it('should carry an unlabelled grant as an empty label', () => {
      // The Queue Service allows a null label; the repository coerces it to ''
      // so both backends represent "no label" identically.
      const unlabelled = delegate().with('label', '').build();

      const [policy] = mapV2([unlabelled]);

      expect(proposerData(policy).proposers[0].delegatedBy).toStrictEqual([
        { delegator: unlabelled.delegator, label: '' },
      ]);
    });
  });
});
