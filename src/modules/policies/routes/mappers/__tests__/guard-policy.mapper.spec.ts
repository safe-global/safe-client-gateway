// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, zeroAddress } from 'viem';
import type {
  CosignerPolicyData,
  Erc20TransferPolicyData,
} from '#/modules/policies/domain/entities/active-policy.entity';
import { policyIndexerGuardEnforcedPolicyBuilder } from '#/modules/policies/domain/entities/indexer/__tests__/guard-enforced-policy.builder';
import type {
  PolicyIndexerGuardEnforcedPolicy,
  PolicyIndexerGuardPolicyKind,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PolicyAccess } from '#/modules/policies/domain/entities/policy-enforcement.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import { GuardPolicyMapper } from '#/modules/policies/routes/mappers/guard-policy.mapper';

const SEPOLIA = '11155111';
const TRANSFER_SELECTOR = '0xa9059cbb';

describe('GuardPolicyMapper', () => {
  let target: GuardPolicyMapper;
  const safe = {
    chainId: SEPOLIA,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const guard = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    target = new GuardPolicyMapper();
  });

  function map(
    bindings: Array<PolicyIndexerGuardEnforcedPolicy>,
    overrides?: {
      transactionGuard?: Address | null;
      moduleGuard?: Address | null;
    },
  ) {
    return target.map({
      safe,
      bindings,
      transactionGuard:
        overrides?.transactionGuard === undefined
          ? guard
          : overrides.transactionGuard,
      moduleGuard:
        overrides?.moduleGuard === undefined ? null : overrides.moduleGuard,
    });
  }

  /** A binding of `safe` on `guard`. */
  function binding(): ReturnType<
    typeof policyIndexerGuardEnforcedPolicyBuilder
  > {
    return policyIndexerGuardEnforcedPolicyBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', safe.address)
      .with('guard', guard);
  }

  function accessOf(policy: PolicyIndexerGuardEnforcedPolicy): PolicyAccess {
    return {
      target: policy.target,
      selector: policy.selector,
      operation: policy.operation,
    };
  }

  describe('kinds', () => {
    it('should report an allowlist with the token the access targets', () => {
      // The policy keys its recipients by token, and the access target is the
      // token - so the binding names the token its list applies to.
      const token = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const policy = binding()
        .with('kind', 'ERC20_TRANSFER')
        .with('target', token)
        .with('selector', TRANSFER_SELECTOR)
        .with('state', {
          recipients: [{ account: recipient, permission: 'ALWAYS' }],
        })
        .build();

      const [result] = map([policy]);

      expect(result.type).toBe(PolicyType.Erc20Transfer);
      expect(result.data as Erc20TransferPolicyData).toStrictEqual({
        tokenAddress: token,
        recipients: [{ account: recipient, permission: 'ALWAYS' }],
      });
    });

    it.each([['ONCE'], ['ALWAYS']])(
      'should report a %s grant as the policy holds it',
      (permission) => {
        const account = getAddress(faker.finance.ethereumAddress());
        const policy = binding()
          .with('kind', 'ERC20_TRANSFER')
          .with('state', { recipients: [{ account, permission }] })
          .build();

        const [result] = map([policy]);

        expect(
          (result.data as Erc20TransferPolicyData).recipients,
        ).toStrictEqual([{ account, permission }]);
      },
    );

    it('should report the accumulated recipient list as the indexer folded it', () => {
      // `configure` is an upsert of deltas, so only the folded sequence is the
      // allowlist - and the indexer has already folded it.
      const recipients = [
        {
          account: getAddress(faker.finance.ethereumAddress()),
          permission: 'ALWAYS',
        },
        {
          account: getAddress(faker.finance.ethereumAddress()),
          permission: 'ONCE',
        },
        {
          account: getAddress(faker.finance.ethereumAddress()),
          permission: 'ALWAYS',
        },
      ];
      const policy = binding()
        .with('kind', 'ERC20_TRANSFER')
        .with('state', { recipients })
        .build();

      const [result] = map([policy]);

      expect((result.data as Erc20TransferPolicyData).recipients).toStrictEqual(
        recipients,
      );
    });

    it('should report a cosigner as the whole payload', () => {
      const cosigner = getAddress(faker.finance.ethereumAddress());
      const policy = binding()
        .with('kind', 'COSIGNER')
        .with('state', { cosigner })
        .build();

      const [result] = map([policy]);

      expect(result.type).toBe(PolicyType.Cosigner);
      expect(result.data as CosignerPolicyData).toStrictEqual({
        cosignerAddress: cosigner,
      });
    });

    it.each<[PolicyIndexerGuardPolicyKind, PolicyType]>([
      ['ALLOW', PolicyType.Allow],
      ['DENY', PolicyType.Deny],
      ['NATIVE_TRANSFER', PolicyType.NativeTransfer],
      ['MULTISEND', PolicyType.MultiSend],
    ])('should report %s with an empty payload', (kind, type) => {
      const policy = binding().with('kind', kind).with('state', null).build();

      const [result] = map([policy]);

      expect(result.type).toBe(type);
      expect(result.data).toStrictEqual({});
    });

    it.each<PolicyIndexerGuardPolicyKind>([
      'ERC20_APPROVE',
      'ALLOWED_MODULE',
      'UNKNOWN',
    ])('should skip %s, which CGW does not render', (kind) => {
      // Rendering an unknown restriction is worse than omitting it.
      const policy = binding().with('kind', kind).with('state', null).build();

      expect(map([policy])).toStrictEqual([]);
    });

    it('should keep the rendered bindings beside one it does not render', () => {
      const rendered = binding()
        .with('kind', 'ALLOW')
        .with('state', null)
        .build();
      const unrendered = binding()
        .with('kind', 'ERC20_APPROVE')
        .with('state', null)
        .build();

      expect(map([rendered, unrendered])).toHaveLength(1);
    });
  });

  describe('identity and enforcement', () => {
    it('should report the guard and the policy contract inline', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = map([policy]);

      expect(result.enforcement).toStrictEqual({
        via: 'guard',
        guards: {
          transactionGuard: {
            policyContract: policy.policy,
            safePolicyGuard: guard,
          },
        },
        access: accessOf(policy),
      });
    });

    it('should report a policy as unenforced when the safe has no guard set', () => {
      // configureImmediately runs before setGuard, so a configured policy with
      // no guard is a normal state the wallet has to prompt about.
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = map([policy], { transactionGuard: null });

      expect(result.enabled).toBe(false);
      expect(result.enforcement).toStrictEqual({
        via: 'guard',
        guards: {},
        access: accessOf(policy),
      });
    });

    it('should report the module guard slot when only the module guard is set', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = map([policy], {
        transactionGuard: null,
        moduleGuard: guard,
      });

      expect(result.enabled).toBe(true);
      expect(result.enforcement).toStrictEqual({
        via: 'guard',
        guards: {
          moduleGuard: {
            policyContract: policy.policy,
            safePolicyGuard: guard,
          },
        },
        access: accessOf(policy),
      });
    });

    it('should report both slots when the guard is set in both', () => {
      const policy = binding().with('state', { recipients: [] }).build();
      const contracts = {
        policyContract: policy.policy,
        safePolicyGuard: guard,
      };

      const [result] = map([policy], {
        transactionGuard: guard,
        moduleGuard: guard,
      });

      expect(result.enabled).toBe(true);
      expect(result.enforcement).toStrictEqual({
        via: 'guard',
        guards: { transactionGuard: contracts, moduleGuard: contracts },
        access: accessOf(policy),
      });
    });

    it('should report only the slot holding the guard when the other holds another', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = map([policy], {
        transactionGuard: getAddress(faker.finance.ethereumAddress()),
        moduleGuard: guard,
      });

      expect(result.enabled).toBe(true);
      expect(result.enforcement).toStrictEqual({
        via: 'guard',
        guards: {
          moduleGuard: {
            policyContract: policy.policy,
            safePolicyGuard: guard,
          },
        },
        access: accessOf(policy),
      });
    });

    it('should report a policy as unenforced when another guard is set', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = map([policy], {
        transactionGuard: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result.enabled).toBe(false);
    });

    it('should match the safe guard regardless of casing', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = map([policy], {
        transactionGuard: guard.toLowerCase() as `0x${string}`,
      });

      expect(result.enabled).toBe(true);
    });

    it('should report the catch-all binding like any other', () => {
      // The fallback covers every call the specific bindings do not, so it is a
      // policy of the Safe rather than a row to filter out.
      const fallback = binding()
        .with('kind', 'ALLOW')
        .with('target', zeroAddress)
        .with('selector', '0x00000000')
        .with('state', null)
        .build();

      const [result] = map([fallback]);

      expect(result).toMatchObject({
        type: PolicyType.Allow,
        enabled: true,
        data: {},
      });
      expect(result.enforcement).toMatchObject({
        access: {
          target: zeroAddress,
          selector: '0x00000000',
        },
      });
    });

    it('should report the calls the binding governs', () => {
      const policy = binding()
        .with('kind', 'MULTISEND')
        .with('target', getAddress(faker.finance.ethereumAddress()))
        .with(
          'selector',
          faker.string.hexadecimal({
            length: 8,
            casing: 'lower',
          }) as `0x${string}`,
        )
        .with('operation', 'DELEGATECALL')
        .with('state', null)
        .build();

      const [result] = map([policy]);

      expect(result.enforcement).toMatchObject({
        via: 'guard',
        access: {
          target: policy.target,
          selector: policy.selector,
          operation: 'DELEGATECALL',
        },
      });
    });

    it('should tell apart bindings of one policy by the calls they govern', () => {
      // One ALLOW policy bound to three owner-management selectors is three
      // items that differ only in their access.
      const selectors = faker.helpers.uniqueArray(
        () => faker.string.hexadecimal({ length: 8, casing: 'lower' }),
        3,
      ) as Array<`0x${string}`>;
      const bindings = selectors.map((selector) =>
        binding()
          .with('kind', 'ALLOW')
          .with('selector', selector)
          .with('state', null)
          .build(),
      );

      const result = map(bindings);

      expect(result.map((item) => item.enforcement)).toMatchObject(
        selectors.map((selector) => ({ access: { selector } })),
      );
    });

    it('should report one item per binding, even when they share a list', () => {
      // transfer and transferFrom read the same recipients on chain, and the
      // indexer writes the folded list to both rows.
      const token = getAddress(faker.finance.ethereumAddress());
      const state = {
        recipients: [
          {
            account: getAddress(faker.finance.ethereumAddress()),
            permission: 'ALWAYS',
          },
        ],
      };
      const transfer = binding()
        .with('target', token)
        .with('selector', TRANSFER_SELECTOR)
        .with('state', state)
        .build();
      const transferFrom = binding()
        .with('target', token)
        .with('selector', '0x23b872dd')
        .with('state', state)
        .build();

      const result = map([transfer, transferFrom]);

      expect(result).toHaveLength(2);
      expect(
        result.map((item) => item.data as Erc20TransferPolicyData),
      ).toStrictEqual([
        { tokenAddress: token, recipients: state.recipients },
        { tokenAddress: token, recipients: state.recipients },
      ]);
    });

    it('should report an empty list for a safe with no bindings', () => {
      expect(map([])).toStrictEqual([]);
    });
  });
});
