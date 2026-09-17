// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { SpendingLimitAssembler } from '@/modules/policies/domain/assemblers/spending-limit.assembler';
import type { SpendingLimitPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import { policyIndexerResponseBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { policyIndexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

const SEPOLIA = '11155111';

describe('SpendingLimitAssembler', () => {
  const target = new SpendingLimitAssembler();
  const safe = {
    chainId: SEPOLIA,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const allowanceModule = getAddress(faker.finance.ethereumAddress());

  function assemble(
    allowances: Array<PolicyIndexerSafeAllowance>,
    overrides?: { enabledModules?: Array<`0x${string}`> },
  ) {
    return target.assemble({
      safe,
      state: policyIndexerResponseBuilder()
        .with('allowances', allowances)
        .build(),
      enabledModules: overrides?.enabledModules ?? [allowanceModule],
    });
  }

  /** An allowance of `safe` on `allowanceModule`, spendable by default. */
  function allowance(): ReturnType<typeof policyIndexerSafeAllowanceBuilder> {
    return policyIndexerSafeAllowanceBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', safe.address)
      .with('module', allowanceModule)
      .with('amount', '1000')
      .with('spent', '0');
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
          (entry) => entry.tokenAddress,
        ),
      ).toStrictEqual([usdc.token, zeroAddress]);
    });

    it('should report the policy as enforced by its module', () => {
      const [policy] = assemble([allowance().build()]);

      expect(policy).toMatchObject({
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
      expect(result.map((policy) => dataOf(policy).module)).toStrictEqual([
        allowanceModule,
        otherModule,
      ]);
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

  describe('the reset window', () => {
    const DAY_IN_MINUTES = 1440;
    /** Pins now to `minutes` since the epoch, so a boundary can be placed. */
    function nowAtMinute(minutes: number): void {
      vi.useFakeTimers().setSystemTime(minutes * 60 * 1000);
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should derive the reset from the window start', () => {
      // The indexer serves `lastResetMin` - minutes since the epoch - and no
      // longer the boundary itself, so the API computes it.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 1);

      const daily = allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('lastResetMin', windowStart)
        .build();

      const [policy] = assemble([daily]);

      expect(dataOf(policy).spenders[0].allowances[0].resetsAtMinute).toBe(
        windowStart + DAY_IN_MINUTES,
      );
    });

    it('should report a reset ahead of now', () => {
      // Only a transfer rewrites `lastResetMin`, so an untouched allowance
      // carries a window start whole periods back - its next reset is still
      // ahead of now, not on the stale window it was left on.
      const windowStart = 29_793_086;
      const now = windowStart + 10 * DAY_IN_MINUTES;
      nowAtMinute(now);

      const daily = allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('lastResetMin', windowStart)
        .build();

      const [policy] = assemble([daily]);

      const resetsAtMinute =
        dataOf(policy).spenders[0].allowances[0].resetsAtMinute;
      expect(resetsAtMinute).toBe(windowStart + 11 * DAY_IN_MINUTES);
      expect(resetsAtMinute).toBeGreaterThan(now);
    });

    it('should keep the next reset on the boundaries the module resets on', () => {
      // The module snaps a stale window forward by whole periods, so every
      // boundary sits on that lattice - a reset is never reported at now plus
      // one period from an arbitrary minute.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 3 * DAY_IN_MINUTES + 617);

      const daily = allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('lastResetMin', windowStart)
        .build();

      const [policy] = assemble([daily]);

      const resetsAtMinute =
        dataOf(policy).spenders[0].allowances[0].resetsAtMinute;
      expect(resetsAtMinute).toBe(windowStart + 4 * DAY_IN_MINUTES);
      expect((resetsAtMinute! - windowStart) % DAY_IN_MINUTES).toBe(0);
    });

    it('should report the following boundary when one falls on this minute', () => {
      // The module resets on reaching a boundary, so the one landing on this
      // minute has elapsed rather than being the next.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 2 * DAY_IN_MINUTES);

      const daily = allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('lastResetMin', windowStart)
        .build();

      const [policy] = assemble([daily]);

      expect(dataOf(policy).spenders[0].allowances[0].resetsAtMinute).toBe(
        windowStart + 3 * DAY_IN_MINUTES,
      );
    });

    it('should never reset a one-time allowance', () => {
      // `resetTimeMinutes: 0` is a real value, not absence - it is the majority
      // of configured allowances on some deployments.
      const oneTime = allowance()
        .with('amount', '1000')
        .with('spent', '1000')
        .with('resetTimeMinutes', 0)
        .build();

      const [policy] = assemble([oneTime]);

      expect(dataOf(policy).spenders[0].allowances[0]).toMatchObject({
        resetPeriodMinutes: 0,
        resetsAtMinute: null,
      });
    });

    it('should report the reset period in minutes', () => {
      const daily = allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .build();

      const [policy] = assemble([daily]);

      expect(dataOf(policy).spenders[0].allowances[0].resetPeriodMinutes).toBe(
        DAY_IN_MINUTES,
      );
    });

    it('should flag a boundary that could not be recovered exactly', () => {
      // An UNKNOWN boundary can be up to a whole period out; the amount is
      // still right, so the allowance is reported with the caveat rather than
      // dropped.
      const unknown = allowance()
        .with('resetTimeMinutes', 1440)
        .with('resetPhase', 'UNKNOWN')
        .build();

      const [policy] = assemble([unknown]);

      expect(
        dataOf(policy).spenders[0].allowances[0].resetBoundaryIsExact,
      ).toBe(false);
    });
  });

  describe('what is and is not a limit', () => {
    it('should drop a row that was never configured', () => {
      // resetAllowance and deleteAllowance have no registered-delegate check,
      // so an all-zero row can exist for a pair nobody configured.
      const zeroed = allowance().with('amount', '0').with('spent', '0').build();

      expect(assemble([zeroed])).toStrictEqual([]);
    });

    it('should keep a deregistered spender, marked inactive', () => {
      // RemoveDelegate deletes a linked-list node only: the allowance survives
      // and returns to effect if the delegate is re-added.
      const revoked = allowance().with('isDelegateActive', false).build();

      const [policy] = assemble([revoked]);

      expect(dataOf(policy).spenders[0]).toMatchObject({
        spender: revoked.delegate,
        isActive: false,
      });
    });

    it('should report the registration on the allowance too', () => {
      // The client renders the limit itself as unspendable, so the flag travels
      // with the allowance rather than only with the spender.
      const revoked = allowance().with('isDelegateActive', false).build();

      const [policy] = assemble([revoked]);

      expect(dataOf(policy).spenders[0].allowances[0].isDelegateActive).toBe(
        false,
      );
    });

    it('should keep base units as strings beyond the safe integer range', () => {
      const huge = (10n ** 24n).toString();
      const large = allowance().with('amount', huge).with('spent', '0').build();

      const [policy] = assemble([large]);

      expect(dataOf(policy).spenders[0].allowances[0]).toMatchObject({
        amount: huge,
        spent: '0',
      });
    });

    it('should report the native currency by the zero address', () => {
      const native = allowance().with('token', zeroAddress).build();

      const [policy] = assemble([native]);

      expect(dataOf(policy).spenders[0].allowances[0].tokenAddress).toBe(
        zeroAddress,
      );
    });
  });
});
