// SPDX-License-Identifier: FSL-1.1-MIT

import type { Address, Hex } from 'viem';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import type { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import type { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type { PendingTransaction } from '#/modules/policies/domain/entities/pending-policy.entity';
import {
  OnChainPolicyConfigurationsSchema,
  type PolicyConfiguration,
} from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

/** Where a queued call was found, for logging one that does not decode. */
export type QueuedCallContext = { chainId: string; safeTxHash: Hex };

/**
 * The calls a queued transaction makes: the transaction itself, plus - one level
 * only, no recursion - every sub-transaction of a MultiSend batch.
 *
 * `Operation.DELEGATE` calls are dropped: a delegatecall runs against the Safe's
 * own storage, not the target's, so it cannot be a real change of the target -
 * treating it as one would be actively misleading (it is also a known way to
 * disguise an unrelated malicious call as an innocuous one).
 */
export function queuedCalls(
  transaction: MultisigTransaction,
  multiSendDecoder: MultiSendDecoder,
): Array<{ to: Address; data: Hex }> {
  if (!transaction.data) {
    return [];
  }

  const all = [
    {
      to: transaction.to,
      data: transaction.data,
      operation: transaction.operation,
    },
    ...(multiSendDecoder.helpers.isMultiSend(transaction.data)
      ? multiSendDecoder.mapMultiSendTransactions(transaction.data)
      : []),
  ];

  return all
    .filter((call) => call.operation === Operation.CALL)
    .map(({ to, data }) => ({ to, data }));
}

/**
 * The signing state of a queued transaction, as a pending item reports it.
 */
export function pendingTransactionOf(
  transaction: MultisigTransaction,
): PendingTransaction {
  return {
    safeTxHash: transaction.safeTxHash,
    nonce: transaction.nonce,
    confirmations: transaction.confirmations?.length ?? 0,
    confirmationsRequired: transaction.confirmationsRequired,
    proposedAt: toSecondsTimestamp(transaction.submissionDate),
  };
}

/**
 * The configurations a `configureImmediately` or `applyConfiguration` call
 * passes, or `null` for another call or ones the guard would reject. Throws
 * when the arguments do not decode.
 */
export function decodeConfigurations(args: {
  decoder: SafePolicyGuardDecoder;
  data: Hex;
  functionName: 'applyConfiguration' | 'configureImmediately';
}): Array<PolicyConfiguration> | null {
  const decoded = args.decoder.decodeFunctionData({ data: args.data });
  if (
    decoded.functionName !== args.functionName ||
    (decoded.functionName !== 'applyConfiguration' &&
      decoded.functionName !== 'configureImmediately')
  ) {
    return null;
  }

  const parsed = OnChainPolicyConfigurationsSchema.safeParse(decoded.args[0]);
  return parsed.success ? parsed.data : null;
}
