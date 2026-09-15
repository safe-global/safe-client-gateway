// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { GuardPolicyAssembler } from '@/modules/policies/domain/assemblers/guard-policy.assembler';
import type {
  CosignerPolicyData,
  Erc20TransferPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import { policyIndexerResponseBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { policyIndexerSafePolicyBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-policy.builder';
import type { PolicyIndexerSafePolicy } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA = '11155111';
const TRANSFER_SELECTOR = '0xa9059cbb';

describe('GuardPolicyAssembler', () => {
  let target: GuardPolicyAssembler;
  const safe = {
    chainId: SEPOLIA,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const guard = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    target = new GuardPolicyAssembler(mockLoggingService);
  });

  function assemble(
    policies: Array<PolicyIndexerSafePolicy>,
    overrides?: { transactionGuard?: `0x${string}` | null },
  ) {
    return target.assemble({
      safe,
      state: policyIndexerResponseBuilder().with('policies', policies).build(),
      enabledModules: [],
      transactionGuard:
        overrides?.transactionGuard === undefined
          ? guard
          : overrides.transactionGuard,
    });
  }

  /** A binding of `safe` on `guard`. */
  function binding(): ReturnType<typeof policyIndexerSafePolicyBuilder> {
    return policyIndexerSafePolicyBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', safe.address)
      .with('guard', guard);
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

      const [result] = assemble([policy]);

      expect(result.type).toBe(PolicyType.Erc20Transfer);
      expect(result.data as Erc20TransferPolicyData).toStrictEqual({
        allowlist: [
          {
            token_address: token,
            recipients: [{ account: recipient, permission: 'ALWAYS' }],
          },
        ],
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

        const [result] = assemble([policy]);

        expect(
          (result.data as Erc20TransferPolicyData).allowlist[0].recipients,
        ).toStrictEqual([{ account, permission }]);
      },
    );

    it('should skip an allowlist whose permission it does not know', () => {
      // `permission` is inside the indexer's jsonb, so a new value arrives with
      // no schema signal. Guessing between a single-use and an open-ended grant
      // would misreport what the Safe actually permits.
      const policy = binding()
        .with('kind', 'ERC20_TRANSFER')
        .with('state', {
          recipients: [
            {
              account: getAddress(faker.finance.ethereumAddress()),
              permission: 'TWICE',
            },
          ],
        })
        .build();

      expect(assemble([policy])).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not read the state of a policy',
        }),
      );
    });

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

      const [result] = assemble([policy]);

      expect(
        (result.data as Erc20TransferPolicyData).allowlist[0].recipients,
      ).toStrictEqual(recipients);
    });

    it('should report a cosigner as the whole payload', () => {
      const cosigner = getAddress(faker.finance.ethereumAddress());
      const policy = binding()
        .with('kind', 'COSIGNER')
        .with('state', { cosigner })
        .build();

      const [result] = assemble([policy]);

      expect(result.type).toBe(PolicyType.Cosigner);
      expect(result.data as CosignerPolicyData).toStrictEqual({
        cosigner_address: cosigner,
      });
    });

    it.each([
      ['ALLOW', PolicyType.AllowPolicy],
      ['DENY', PolicyType.Deny],
      ['NATIVE_TRANSFER', PolicyType.NativeTransfer],
    ])('should report %s with an empty payload', (kind, type) => {
      const policy = binding()
        .with('kind', kind as PolicyIndexerSafePolicy['kind'])
        .with('state', null)
        .build();

      const [result] = assemble([policy]);

      expect(result.type).toBe(type);
      expect(result.data).toStrictEqual({});
    });

    it.each([
      'ERC20_APPROVE',
      'ALLOWED_MODULE',
      'MULTISEND',
      'NONE',
      'UNKNOWN',
    ])('should skip %s, which CGW does not render', (kind) => {
      // Rendering an unknown restriction is worse than omitting it.
      const policy = binding()
        .with('kind', kind as PolicyIndexerSafePolicy['kind'])
        .build();

      expect(assemble([policy])).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Skipping a policy kind CGW does not render',
          kind,
        }),
      );
    });

    it('should skip a binding whose state is not the shape its kind implies', () => {
      // The indexer's registry and CGW disagree about the policy address.
      const policy = binding()
        .with('kind', 'COSIGNER')
        .with('state', { recipients: [] })
        .build();

      expect(assemble([policy])).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not read the state of a policy',
        }),
      );
    });

    it('should keep the readable bindings when one is not', () => {
      const readable = binding()
        .with('kind', 'ALLOW')
        .with('state', null)
        .build();
      const unreadable = binding().with('kind', 'MULTISEND').build();

      expect(assemble([readable, unreadable])).toHaveLength(1);
    });
  });

  describe('identity and enforcement', () => {
    it('should report the guard and the policy contract inline', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = assemble([policy]);

      expect(result.enforcement).toStrictEqual({
        via: 'guard',
        guards: {
          transactionGuard: {
            policyContract: policy.policy,
            safePolicyGuard: guard,
          },
        },
      });
    });

    it('should report a policy as unenforced when the safe has no guard set', () => {
      // configureImmediately runs before setGuard, so a configured policy with
      // no guard is a normal state the wallet has to prompt about.
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = assemble([policy], { transactionGuard: null });

      expect(result.enabled).toBe(false);
    });

    it('should report a policy as unenforced when another guard is set', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = assemble([policy], {
        transactionGuard: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result.enabled).toBe(false);
    });

    it('should match the safe guard regardless of casing', () => {
      const policy = binding().with('state', { recipients: [] }).build();

      const [result] = assemble([policy], {
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
        .with('isFallback', true)
        .with('state', null)
        .build();

      const [result] = assemble([fallback]);

      expect(result).toMatchObject({
        type: PolicyType.AllowPolicy,
        enabled: true,
        data: {},
      });
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

      const result = assemble([transfer, transferFrom]);

      expect(result).toHaveLength(2);
      expect(
        result.map((item) => (item.data as Erc20TransferPolicyData).allowlist),
      ).toStrictEqual([
        [{ token_address: token, recipients: state.recipients }],
        [{ token_address: token, recipients: state.recipients }],
      ]);
    });

    it('should report an empty list for a safe with no bindings', () => {
      expect(assemble([])).toStrictEqual([]);
    });
  });
});
