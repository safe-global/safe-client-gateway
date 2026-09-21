// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import { policyIndexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';

const SEPOLIA = '11155111';
const DAY_IN_MINUTES = 1440;

describe('SpendingLimitMapper', () => {
  let target: SpendingLimitMapper;
  const safe: SafeRef = {
    chainId: SEPOLIA,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const allowanceModule = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    target = new SpendingLimitMapper();
  });

  /** An allowance of `safe` on `allowanceModule`, spendable by default. */
  function allowance(): IBuilder<PolicyIndexerSafeAllowance> {
    return policyIndexerSafeAllowanceBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', safe.address)
      .with('module', allowanceModule)
      .with('amount', '1000')
      .with('spent', '0');
  }

  /** The policies built from `allowances`, with `allowanceModule` enabled. */
  function map(
    allowances: Array<PolicyIndexerSafeAllowance>,
    enabledModules: Array<Address> = [allowanceModule],
  ): Array<ActivePolicy> {
    return target.map({ safe, allowances, enabledModules });
  }

  describe('nesting the indexer rows into one policy per module', () => {
    it('should report one policy carrying every spender of the module', () => {
      const first = allowance().build();
      const second = allowance()
        .with('delegate', getAddress(faker.finance.ethereumAddress()))
        .build();

      const policies = map([first, second]);

      expect(policies).toHaveLength(1);
      expect(
        policies[0].data.spenders.map((entry) => entry.spender),
      ).toStrictEqual([first.delegate, second.delegate]);
    });

    it('should nest every token of one spender under that spender', () => {
      const spender = getAddress(faker.finance.ethereumAddress());
      const usdc = allowance().with('delegate', spender).build();
      const native = allowance()
        .with('delegate', spender)
        .with('token', zeroAddress)
        .build();

      const [policy] = map([usdc, native]);

      expect(policy.data.spenders).toHaveLength(1);
      expect(
        policy.data.spenders[0].allowances.map((entry) => entry.tokenAddress),
      ).toStrictEqual([usdc.token, zeroAddress]);
    });

    it('should report the policy as enforced by its module', () => {
      const [policy] = map([allowance().build()]);

      expect(policy).toMatchObject({
        type: PolicyType.SpendingLimit,
        enforcement: {
          via: 'module',
          moduleAddress: allowanceModule,
        },
      });
    });

    it('should carry the safe the rows belong to', () => {
      const [policy] = map([allowance().build()]);

      expect(policy.safe).toStrictEqual(safe);
    });

    it('should report nothing for a safe with no allowances', () => {
      expect(map([])).toStrictEqual([]);
    });
  });

  describe('keeping module deployments separate', () => {
    it('should report two deployments as two policies', () => {
      // Two deployments have independent storage, so both ceilings are real;
      // merging them would report one that exists nowhere on chain.
      const otherModule = getAddress(faker.finance.ethereumAddress());
      const onV1 = allowance().with('moduleVersion', '0.1.0').build();
      const onV2 = allowance()
        .with('module', otherModule)
        .with('moduleVersion', '0.1.1')
        .build();

      const policies = map([onV1, onV2], [allowanceModule, otherModule]);

      expect(policies.map((policy) => policy.data.module)).toStrictEqual([
        allowanceModule,
        otherModule,
      ]);
    });
  });

  describe('reporting whether the module is enabled on the safe', () => {
    it('should report a limit on a module the safe has not enabled as unenforced', () => {
      const [policy] = map([allowance().build()], []);

      expect(policy.enabled).toBe(false);
    });

    it('should match the enabled module regardless of casing', () => {
      const lowercased = allowanceModule.toLowerCase() as Address;

      const [policy] = map([allowance().build()], [lowercased]);

      expect(policy.enabled).toBe(true);
    });
  });

  describe('computing when an allowance next resets', () => {
    /** Pins now to `minutes` since the epoch, so a boundary can be placed. */
    function nowAtMinute(minutes: number): void {
      vi.useFakeTimers().setSystemTime(minutes * 60 * 1000);
    }

    /** A daily allowance whose current window began at `windowStart`. */
    function daily(windowStart: number): PolicyIndexerSafeAllowance {
      return allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('lastResetMin', windowStart)
        .build();
    }

    /** The single allowance of the single policy built from `rows`. */
    function onlyAllowance(
      rows: Array<PolicyIndexerSafeAllowance>,
    ): ActivePolicy['data']['spenders'][number]['allowances'][number] {
      return map(rows)[0].data.spenders[0].allowances[0];
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should report the boundary one period after the window start', () => {
      // The indexer serves `lastResetMin` - minutes since the epoch - and not
      // the boundary itself, so the API computes it.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 1);

      expect(onlyAllowance([daily(windowStart)]).resetsAtMinute).toBe(
        windowStart + DAY_IN_MINUTES,
      );
    });

    it('should skip whole periods that elapsed without a transfer', () => {
      // Only a transfer rewrites `lastResetMin`, so an untouched allowance
      // carries a window start whole periods back - its next reset is still
      // ahead of now, not on the stale window it was left on.
      const windowStart = 29_793_086;
      const now = windowStart + 10 * DAY_IN_MINUTES;
      nowAtMinute(now);

      const resetsAtMinute = onlyAllowance([daily(windowStart)]).resetsAtMinute;

      expect(resetsAtMinute).toBe(windowStart + 11 * DAY_IN_MINUTES);
      expect(resetsAtMinute).toBeGreaterThan(now);
    });

    it('should keep the boundary on the lattice the module resets on', () => {
      // The module snaps a stale window forward by whole periods, so every
      // boundary sits on that lattice - a reset is never reported at now plus
      // one period from an arbitrary minute.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 3 * DAY_IN_MINUTES + 617);

      const resetsAtMinute = onlyAllowance([daily(windowStart)]).resetsAtMinute;

      expect(resetsAtMinute).toBe(windowStart + 4 * DAY_IN_MINUTES);
      expect(((resetsAtMinute ?? 0) - windowStart) % DAY_IN_MINUTES).toBe(0);
    });

    it('should report the following boundary when one falls on this minute', () => {
      // The module resets on reaching a boundary, so the one landing on this
      // minute has elapsed rather than being the next.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 2 * DAY_IN_MINUTES);

      expect(onlyAllowance([daily(windowStart)]).resetsAtMinute).toBe(
        windowStart + 3 * DAY_IN_MINUTES,
      );
    });

    it('should report the reset period in minutes', () => {
      expect(onlyAllowance([daily(29_793_086)]).resetPeriodMinutes).toBe(
        DAY_IN_MINUTES,
      );
    });

    it('should never reset a one-time allowance', () => {
      // `resetTimeMinutes: 0` is a real value, not absence - it is the majority
      // of configured allowances on some deployments.
      const oneTime = allowance()
        .with('spent', '1000')
        .with('resetTimeMinutes', 0)
        .build();

      expect(onlyAllowance([oneTime])).toMatchObject({
        resetPeriodMinutes: 0,
        resetsAtMinute: null,
      });
    });

    it('should flag a boundary that could not be recovered exactly', () => {
      // An UNKNOWN boundary can be up to a whole period out; the amount is
      // still right, so the allowance is reported with the caveat rather than
      // dropped.
      const unknown = allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('resetPhase', 'UNKNOWN')
        .build();

      expect(onlyAllowance([unknown]).resetBoundaryIsExact).toBe(false);
    });

    /** A daily allowance with `spent` against the window from `windowStart`. */
    function dailySpent(
      windowStart: number,
      spent: string,
    ): PolicyIndexerSafeAllowance {
      return allowance()
        .with('resetTimeMinutes', DAY_IN_MINUTES)
        .with('lastResetMin', windowStart)
        .with('spent', spent)
        .build();
    }

    it('should report 0 spent once the window has rolled over', () => {
      // The module zeroes `spent` on read, but only a transfer writes it back,
      // so the indexer keeps serving the closed window's figure. Reporting it
      // would show a spent-out allowance as exhausted until someone spends
      // against it again - which they cannot, because it looks exhausted.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + DAY_IN_MINUTES);

      expect(onlyAllowance([dailySpent(windowStart, '1000')]).spent).toBe('0');
    });

    it('should keep the spent amount until the window resets', () => {
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + DAY_IN_MINUTES - 1);

      expect(onlyAllowance([dailySpent(windowStart, '250')]).spent).toBe('250');
    });

    it('should report 0 spent after whole periods without a transfer', () => {
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 10 * DAY_IN_MINUTES + 617);

      expect(onlyAllowance([dailySpent(windowStart, '999')]).spent).toBe('0');
    });

    it('should keep what was spent on an allowance that never resets', () => {
      // `resetTimeMinutes` of 0 has no window to roll over, so the figure
      // stands however long ago it was spent.
      const spentOnce = allowance()
        .with('resetTimeMinutes', 0)
        .with('lastResetMin', 29_793_086)
        .with('spent', '250')
        .build();
      nowAtMinute(29_793_086 + 10 * DAY_IN_MINUTES);

      const reported = onlyAllowance([spentOnce]);

      expect(reported.spent).toBe('250');
      expect(reported.resetsAtMinute).toBeNull();
    });

    it('should report nothing spent from the minute the boundary lands on', () => {
      // The module resets on *reaching* a boundary, so the two must agree: the
      // minute that stops being the next reset is the minute `spent` clears.
      const windowStart = 29_793_086;
      nowAtMinute(windowStart + 2 * DAY_IN_MINUTES);

      const reported = onlyAllowance([dailySpent(windowStart, '1000')]);

      expect(reported.spent).toBe('0');
      expect(reported.resetsAtMinute).toBe(windowStart + 3 * DAY_IN_MINUTES);
    });
  });

  describe('dropping rows that are not a limit', () => {
    it('should drop a row that was never configured', () => {
      // resetAllowance and deleteAllowance have no registered-delegate check,
      // so an all-zero row can exist for a pair nobody configured.
      const zeroed = allowance().with('amount', '0').with('spent', '0').build();

      expect(map([zeroed])).toStrictEqual([]);
    });
  });

  describe('a spender whose registration was removed', () => {
    it('should keep the spender, marked inactive', () => {
      // RemoveDelegate deletes a linked-list node only: the allowance survives
      // and returns to effect if the delegate is re-added.
      const revoked = allowance().with('isDelegateActive', false).build();

      const [policy] = map([revoked]);

      expect(policy.data.spenders[0]).toMatchObject({
        spender: revoked.delegate,
        isActive: false,
      });
    });

    it('should report the removal on the allowance too', () => {
      // The client renders the limit itself as unspendable, so the flag travels
      // with the allowance rather than only with the spender.
      const revoked = allowance().with('isDelegateActive', false).build();

      const [policy] = map([revoked]);

      expect(policy.data.spenders[0].allowances[0].isDelegateActive).toBe(
        false,
      );
    });
  });

  describe('reporting amounts and tokens', () => {
    it('should keep base units as strings beyond the safe integer range', () => {
      const huge = (10n ** 24n).toString();
      const large = allowance().with('amount', huge).with('spent', '0').build();

      const [policy] = map([large]);

      expect(policy.data.spenders[0].allowances[0]).toMatchObject({
        amount: huge,
        spent: '0',
      });
    });

    it('should report the native currency by the zero address', () => {
      const native = allowance().with('token', zeroAddress).build();

      const [policy] = map([native]);

      expect(policy.data.spenders[0].allowances[0].tokenAddress).toBe(
        zeroAddress,
      );
    });
  });
});
