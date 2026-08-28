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
import { policyIndexerStateBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { indexerSafePolicyBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-policy.builder';
import type { IndexerSafePolicy } from '@/modules/policies/domain/entities/indexer/safe-policy.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { guardPolicyId } from '@/modules/policies/domain/utils/policy-id.utils';

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
    policies: Array<IndexerSafePolicy>,
    overrides?: { transactionGuard?: `0x${string}` | null },
  ) {
    return target.assemble({
      safe,
      state: policyIndexerStateBuilder().with('policies', policies).build(),
      enabledModules: [],
      transactionGuard:
        overrides?.transactionGuard === undefined
          ? guard
          : overrides.transactionGuard,
      now: 1_800_000_000,
    });
  }

  /** A binding of `safe` on `guard`. */
  function binding(): ReturnType<typeof indexerSafePolicyBuilder> {
    return indexerSafePolicyBuilder()
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
        .with('state', { recipients: [recipient] })
        .build();

      const [result] = assemble([policy]);

      expect(result.type).toBe(PolicyType.Erc20Transfer);
      expect(result.data as Erc20TransferPolicyData).toStrictEqual({
        allowlist: [{ token_address: token, recipients: [recipient] }],
      });
    });

    it('should report the accumulated recipient list as the indexer folded it', () => {
      // `configure` is an upsert of deltas, so only the folded sequence is the
      // allowlist - and the indexer has already folded it.
      const recipients = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
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
        .with('kind', kind as IndexerSafePolicy['kind'])
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
        .with('kind', kind as IndexerSafePolicy['kind'])
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
    it('should identify a binding by its access word', () => {
      const policy = binding()
        .with('selector', TRANSFER_SELECTOR)
        .with('state', { recipients: [] })
        .build();

      const [result] = assemble([policy]);

      expect(result.id).toBe(
        guardPolicyId({
          target: policy.target,
          selector: policy.selector,
          operation: policy.operation,
        }),
      );
    });

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

    it('should report the fallback binding by its all-zero access word', () => {
      const fallback = binding()
        .with('kind', 'ALLOW')
        .with('target', zeroAddress)
        .with('selector', '0x00000000')
        .with('isFallback', true)
        .with('state', null)
        .build();

      const [result] = assemble([fallback]);

      expect(result.id).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
    });

    it('should report one item per binding, even when they share a list', () => {
      // transfer and transferFrom read the same recipients on chain, and the
      // indexer writes the folded list to both rows.
      const token = getAddress(faker.finance.ethereumAddress());
      const state = {
        recipients: [getAddress(faker.finance.ethereumAddress())],
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
      expect(result[0].id).not.toBe(result[1].id);
    });

    it('should report an empty list for a safe with no bindings', () => {
      expect(assemble([])).toStrictEqual([]);
    });
  });
});
