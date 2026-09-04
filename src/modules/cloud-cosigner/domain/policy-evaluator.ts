// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, isAddressEqual } from 'viem';
import type { CloudCosignerPolicy } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import { PolicyRule } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import {
  getCalledContracts,
  hasDelegateCallOutside,
  type TransactionAnalysis,
  type TransactionValuation,
  touchesAddress,
} from '@/modules/cloud-cosigner/domain/transaction-analysis';

export type PolicyEvaluation = {
  triggeredRules: Array<PolicyRule>;
  // One human-readable line per triggered rule, fed to the reviewer.
  reasons: Array<string>;
};

/**
 * Decides whether a transaction needs the model's review. No rule triggered
 * means the cosigner signs on the fast path. The evaluation is a pure
 * function of already-fetched data so the rule set stays testable in
 * isolation.
 */
export function evaluatePolicy(args: {
  policy: CloudCosignerPolicy;
  analysis: TransactionAnalysis;
  valuation: TransactionValuation;
  safeAddress: Address;
  // Contracts the Safe already executed a transaction against.
  knownContracts: Array<Address>;
  // Official MultiSend deployments a delegatecall may legitimately target.
  allowedDelegateCallTargets: Array<Address>;
  fiatCode: string;
}): PolicyEvaluation {
  const evaluation: PolicyEvaluation = { triggeredRules: [], reasons: [] };
  const trigger = (rule: PolicyRule, reason: string): void => {
    evaluation.triggeredRules.push(rule);
    evaluation.reasons.push(reason);
  };

  if (args.valuation.knownFiatValue > args.policy.valueThresholdUsd) {
    trigger(
      PolicyRule.VALUE_OVER_THRESHOLD,
      `Moves about ${Math.round(args.valuation.knownFiatValue)} ${args.fiatCode}, above the ${args.policy.valueThresholdUsd} ${args.fiatCode} policy threshold.`,
    );
  }

  if (args.valuation.hasUnknownValue) {
    trigger(
      PolicyRule.UNKNOWN_VALUE,
      'Moves or approves an asset whose fiat value could not be determined.',
    );
  }

  if (args.policy.reviewUnknownContracts) {
    const unknown = getCalledContracts(args.analysis).filter(
      (contract) =>
        !(
          isAddressEqual(contract, args.safeAddress) ||
          args.knownContracts.some((known) => isAddressEqual(known, contract))
        ),
    );
    if (unknown.length > 0) {
      trigger(
        PolicyRule.UNKNOWN_CONTRACT,
        `First interaction of this Safe with: ${unknown.join(', ')}.`,
      );
    }
  }

  if (hasDelegateCallOutside(args.analysis, args.allowedDelegateCallTargets)) {
    trigger(
      PolicyRule.DELEGATE_CALL,
      'Uses delegatecall to a contract other than an official MultiSend.',
    );
  }

  if (touchesAddress(args.analysis, args.safeAddress)) {
    trigger(
      PolicyRule.SAFE_SETTINGS_CHANGE,
      'Calls the Safe itself, i.e. changes owners, threshold, modules, guard or fallback handler.',
    );
  }

  return evaluation;
}
