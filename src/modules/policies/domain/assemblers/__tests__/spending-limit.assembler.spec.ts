// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { SpendingLimitAssembler } from '@/modules/policies/domain/assemblers/spending-limit.assembler';
import type { SpendingLimitPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import { policyIndexerStateBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { indexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { IndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { modulePolicyId } from '@/modules/policies/domain/utils/policy-id.utils';

const SEPOLIA = '11155111';
const NOW = 1_800_000_000;

describe('SpendingLimitAssembler', () => {
  const target = new SpendingLimitAssembler();
  const safe = {
    chainId: SEPOLIA,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const allowanceModule = getAddress(faker.finance.ethereumAddress());

  function assemble(
    allowances: Array<IndexerSafeAllowance>,
    overrides?: { enabledModules?: Array<`0x${string}`>; now?: number },
  ) {
    return target.assemble({
      safe,
      state: policyIndexerStateBuilder().with('allowances', allowances).build(),
      enabledModules: overrides?.enabledModules ?? [allowanceModule],
      now: overrides?.now ?? NOW,
    });
  }

  /** An allowance of `safe` on `allowanceModule`, spendable by default. */
  function allowance(): ReturnType<typeof indexerSafeAllowanceBuilder> {
    return indexerSafeAllowanceBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', safe.address)
      .with('module', allowanceModule)
      .with('amount', '1000')
      .with('spent', '0')
      .with('remaining', '1000');
  }

  function dataOf(policy: { data: unknown }): SpendingLimitPolicyData {
    return policy.data as SpendingLimitPolicyData;
  }

  describe('shape', () => {
    it('should report one policy per safe, with the spenders nested', () => {
      const first = allowance().build();
      const second = allowance()
        .with('delegate', getAddress(faker.finance.ethereumAddress()))
        .build();

      const result = assemble([first, second]);

      expect(result).toHaveLength(1);
      expect(
        dataOf(result[0]).spenders.map((entry) => entry.spender),
      ).toStrictEqual([first.delegate, second.delegate]);
    });

    it('should nest every token of one spender', () => {
      const spender = getAddress(faker.finance.ethereumAddress());
      const usdc = allowance().with('delegate', spender).build();
      const native = allowance()
        .with('delegate', spender)
        .with('token', zeroAddress)
        .build();

      const [policy] = assemble([usdc, native]);

      expect(dataOf(policy).spenders).toHaveLength(1);
      expect(
        dataOf(policy).spenders[0].allowances.map(
          (entry) => entry.token_address,
        ),
      ).toStrictEqual([usdc.token, zeroAddress]);
    });

    it('should identify the policy by its module and safe', () => {
      const [policy] = assemble([allowance().build()]);

      expect(policy).toMatchObject({
        id: modulePolicyId({
          type: PolicyType.SpendingLimit,
          moduleAddress: allowanceModule,
          safe,
        }),
        type: PolicyType.SpendingLimit,
        enforcement: { via: 'module', moduleAddress: allowanceModule },
      });
    });

    it('should report an empty list for a safe with no allowances', () => {
      expect(assemble([])).toStrictEqual([]);
    });
  });

  describe('module deployments', () => {
    it('should report two module versions as two policies', () => {
      // Two deployments have independent storage, so both ceilings are real;
      // merging them would report one that exists nowhere on chain.
      const otherModule = getAddress(faker.finance.ethereumAddress());
      const onV1 = allowance().with('moduleVersion', '0.1.0').build();
      const onV2 = allowance()
        .with('module', otherModule)
        .with('moduleVersion', '0.1.1')
        .build();

      const result = assemble([onV1, onV2], {
        enabledModules: [allowanceModule, otherModule],
      });

      expect(result).toHaveLength(2);
      expect(
        result.map((policy) => dataOf(policy).moduleVersion),
      ).toStrictEqual(['0.1.0', '0.1.1']);
      expect(result[0].id).not.toBe(result[1].id);
    });

    it('should report a limit on a module the safe has not enabled as not enforced', () => {
      const result = assemble([allowance().build()], { enabledModules: [] });

      expect(result[0].enabled).toBe(false);
    });

    it('should match the enabled module regardless of casing', () => {
      const result = assemble([allowance().build()], {
        enabledModules: [allowanceModule.toLowerCase() as `0x${string}`],
      });

      expect(result[0].enabled).toBe(true);
    });
  });

  describe('the pending reset', () => {
    it('should report the full amount once the window has rolled', () => {
      // The module zeroes `spent` lazily and emits nothing, so the row still
      // says it was spent. Without this rule a reset allowance reads as spent
      // out.
      const rolled = allowance()
        .with('amount', '1000')
        .with('spent', '900')
        .with('remaining', '100')
        .with('resetTimeMinutes', 1440)
        .with('nextResetAt', NOW - 1)
        .build();

      const [policy] = assemble([rolled]);

      expect(dataOf(policy).spenders[0].allowances[0]).toMatchObject({
        spent: '900',
        remaining: '100',
        available: '1000',
      });
    });

    it('should report what is left while the window is open', () => {
      const open = allowance()
        .with('amount', '1000')
        .with('spent', '900')
        .with('remaining', '100')
        .with('resetTimeMinutes', 1440)
        .with('nextResetAt', NOW + 1)
        .build();

      const [policy] = assemble([open]);

      expect(dataOf(policy).spenders[0].allowances[0].available).toBe('100');
    });

    it('should never reset a one-time allowance', () => {
      // `resetTimeMinutes: 0` is a real value, not absence - it is the majority
      // of configured allowances on some deployments.
      const oneTime = allowance()
        .with('amount', '1000')
        .with('spent', '1000')
        .with('remaining', '0')
        .with('resetTimeMinutes', 0)
        .with('nextResetAt', 0)
        .build();

      const [policy] = assemble([oneTime]);

      expect(dataOf(policy).spenders[0].allowances[0]).toMatchObject({
        available: '0',
        resetPeriodSeconds: 0,
        resetsAt: null,
      });
    });

    it('should report the reset period in seconds', () => {
      const daily = allowance().with('resetTimeMinutes', 1440).build();

      const [policy] = assemble([daily]);

      expect(dataOf(policy).spenders[0].allowances[0].resetPeriodSeconds).toBe(
        86_400,
      );
    });

    it('should flag a boundary that could not be recovered exactly', () => {
      // An ASSUMED boundary can be up to a whole period out; the amount is
      // still right, so the allowance is reported with the caveat rather than
      // dropped.
      const assumed = allowance()
        .with('resetTimeMinutes', 1440)
        .with('resetPhase', 'ASSUMED')
        .build();

      const [policy] = assemble([assumed]);

      expect(
        dataOf(policy).spenders[0].allowances[0].resetBoundaryIsExact,
      ).toBe(false);
    });
  });

  describe('what is and is not a limit', () => {
    it('should drop a row that was never configured', () => {
      // resetAllowance and deleteAllowance have no registered-delegate check,
      // so an all-zero row can exist for a pair nobody configured.
      const zeroed = allowance()
        .with('amount', '0')
        .with('spent', '0')
        .with('remaining', '0')
        .build();

      expect(assemble([zeroed])).toStrictEqual([]);
    });

    it('should keep a deregistered spender, marked inactive', () => {
      // RemoveDelegate deletes a linked-list node only: the allowance survives
      // and returns to effect if the delegate is re-added.
      const revoked = allowance().with('delegateActive', false).build();

      const [policy] = assemble([revoked]);

      expect(dataOf(policy).spenders[0]).toMatchObject({
        spender: revoked.delegate,
        isActive: false,
      });
    });

    it('should keep base units as strings beyond the safe integer range', () => {
      const huge = (10n ** 24n).toString();
      const large = allowance()
        .with('amount', huge)
        .with('spent', '0')
        .with('remaining', huge)
        .build();

      const [policy] = assemble([large]);

      expect(dataOf(policy).spenders[0].allowances[0]).toMatchObject({
        amount: huge,
        remaining: huge,
        available: huge,
      });
    });

    it('should report the native currency by the zero address', () => {
      const native = allowance().with('token', zeroAddress).build();

      const [policy] = assemble([native]);

      expect(dataOf(policy).spenders[0].allowances[0].token_address).toBe(
        zeroAddress,
      );
    });
  });
});
