// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { cloudCosignerPolicyBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import { PolicyRule } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import { evaluatePolicy } from '@/modules/cloud-cosigner/domain/policy-evaluator';
import type {
  TransactionAnalysis,
  TransactionValuation,
} from '@/modules/cloud-cosigner/domain/transaction-analysis';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const address = (): ReturnType<typeof getAddress> =>
  getAddress(faker.finance.ethereumAddress());

function analysis(
  overrides: Partial<TransactionAnalysis> = {},
): TransactionAnalysis {
  return { legs: [], calls: [], isMultiSend: false, ...overrides };
}

function valuation(
  overrides: Partial<TransactionValuation> = {},
): TransactionValuation {
  return {
    legs: [],
    isMultiSend: false,
    knownFiatValue: 0,
    hasUnknownValue: false,
    ...overrides,
  };
}

describe('evaluatePolicy', () => {
  const safeAddress = address();
  const multiSend = address();
  const base = {
    safeAddress,
    knownContracts: [],
    allowedDelegateCallTargets: [multiSend],
    fiatCode: 'USD',
  };
  const permissive = cloudCosignerPolicyBuilder()
    .with('valueThresholdUsd', 100_000)
    .with('reviewUnknownContracts', false)
    .build();

  it('should trigger nothing for a small transfer to a known recipient', () => {
    const result = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis({
        calls: [
          {
            to: address(),
            operation: Operation.CALL,
            method: null,
            hasData: false,
          },
        ],
      }),
      valuation: valuation({ knownFiatValue: 50 }),
    });

    expect(result.triggeredRules).toStrictEqual([]);
    expect(result.reasons).toStrictEqual([]);
  });

  it('should trigger VALUE_OVER_THRESHOLD above the policy threshold', () => {
    const result = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis(),
      valuation: valuation({ knownFiatValue: 100_001 }),
    });

    expect(result.triggeredRules).toStrictEqual([
      PolicyRule.VALUE_OVER_THRESHOLD,
    ]);
    expect(result.reasons[0]).toContain('100001 USD');
  });

  it('should not trigger VALUE_OVER_THRESHOLD at exactly the threshold', () => {
    const result = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis(),
      valuation: valuation({ knownFiatValue: 100_000 }),
    });

    expect(result.triggeredRules).toStrictEqual([]);
  });

  it('should trigger UNKNOWN_VALUE when a leg could not be priced', () => {
    const result = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis(),
      valuation: valuation({ hasUnknownValue: true }),
    });

    expect(result.triggeredRules).toStrictEqual([PolicyRule.UNKNOWN_VALUE]);
  });

  it('should trigger UNKNOWN_CONTRACT for a first interaction when the policy asks for it', () => {
    const known = address();
    const unknown = address();
    const policy = cloudCosignerPolicyBuilder()
      .with('valueThresholdUsd', 100_000)
      .with('reviewUnknownContracts', true)
      .build();
    const calls = [
      {
        to: known,
        operation: Operation.CALL,
        method: 'transfer',
        hasData: true,
      },
      { to: unknown, operation: Operation.CALL, method: 'swap', hasData: true },
    ];

    const flagged = evaluatePolicy({
      ...base,
      policy,
      knownContracts: [known],
      analysis: analysis({ calls }),
      valuation: valuation(),
    });
    const allKnown = evaluatePolicy({
      ...base,
      policy,
      knownContracts: [known, unknown],
      analysis: analysis({ calls }),
      valuation: valuation(),
    });
    const disabled = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis({ calls }),
      valuation: valuation(),
    });

    expect(flagged.triggeredRules).toStrictEqual([PolicyRule.UNKNOWN_CONTRACT]);
    expect(flagged.reasons[0]).toContain(unknown);
    expect(flagged.reasons[0]).not.toContain(known);
    expect(allKnown.triggeredRules).toStrictEqual([]);
    expect(disabled.triggeredRules).toStrictEqual([]);
  });

  it('should not count the Safe itself as an unknown contract', () => {
    const policy = cloudCosignerPolicyBuilder()
      .with('valueThresholdUsd', 100_000)
      .with('reviewUnknownContracts', true)
      .build();

    const result = evaluatePolicy({
      ...base,
      policy,
      analysis: analysis({
        calls: [
          {
            to: safeAddress,
            operation: Operation.CALL,
            method: 'addOwnerWithThreshold',
            hasData: true,
          },
        ],
      }),
      valuation: valuation(),
    });

    expect(result.triggeredRules).toStrictEqual([
      PolicyRule.SAFE_SETTINGS_CHANGE,
    ]);
  });

  it('should trigger DELEGATE_CALL outside official MultiSend contracts only', () => {
    const outside = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis({
        calls: [
          {
            to: address(),
            operation: Operation.DELEGATE,
            method: null,
            hasData: true,
          },
        ],
      }),
      valuation: valuation(),
    });
    const viaMultiSend = evaluatePolicy({
      ...base,
      policy: permissive,
      analysis: analysis({
        calls: [
          {
            to: multiSend,
            operation: Operation.DELEGATE,
            method: 'multiSend',
            hasData: true,
          },
        ],
      }),
      valuation: valuation(),
    });

    expect(outside.triggeredRules).toStrictEqual([PolicyRule.DELEGATE_CALL]);
    expect(viaMultiSend.triggeredRules).toStrictEqual([]);
  });

  it('should collect every triggered rule with a matching reason', () => {
    const policy = cloudCosignerPolicyBuilder()
      .with('valueThresholdUsd', 10)
      .with('reviewUnknownContracts', true)
      .build();

    const result = evaluatePolicy({
      ...base,
      policy,
      analysis: analysis({
        calls: [
          {
            to: address(),
            operation: Operation.DELEGATE,
            method: null,
            hasData: true,
          },
          {
            to: safeAddress,
            operation: Operation.CALL,
            method: 'changeThreshold',
            hasData: true,
          },
        ],
      }),
      valuation: valuation({ knownFiatValue: 11, hasUnknownValue: true }),
    });

    expect(result.triggeredRules).toStrictEqual([
      PolicyRule.VALUE_OVER_THRESHOLD,
      PolicyRule.UNKNOWN_VALUE,
      PolicyRule.UNKNOWN_CONTRACT,
      PolicyRule.DELEGATE_CALL,
      PolicyRule.SAFE_SETTINGS_CHANGE,
    ]);
    expect(result.reasons).toHaveLength(5);
  });
});
