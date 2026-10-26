// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, type Hex, isAddressEqual } from 'viem';
import { getAllMultiSendDeployments } from '#/domain/common/utils/deployments';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import type { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import type { PendingTransaction } from '#/modules/policies/domain/entities/pending-policy.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

/**
 * The calls a queued transaction makes on the Safe's behalf: the transaction
 * itself, or - one level only, no recursion - the sub-transactions of a
 * MultiSend batch.
 *
 * A batch is unpacked only when the transaction delegatecalls an official
 * MultiSend or MultiSendCallOnly deployment.
 *
 * `Operation.DELEGATE` calls are then dropped: a delegatecall runs against the
 * Safe's own storage, not the target's, so it cannot be a real change of the
 * target - treating it as one would be actively misleading (it is also a known
 * way to disguise an unrelated malicious call as an innocuous one).
 */
export function queuedCalls(args: {
  chainId: string;
  transaction: MultisigTransaction;
  multiSendDecoder: MultiSendDecoder;
}): Array<{ to: Address; data: Hex }> {
  const { transaction, multiSendDecoder } = args;
  const { data } = transaction;
  if (!data) {
    return [];
  }

  const calls = isMultiSendBatch({ ...args, data })
    ? multiSendDecoder.mapMultiSendTransactions(data)
    : [{ to: transaction.to, data, operation: transaction.operation }];

  return calls
    .filter((call) => call.operation === Operation.CALL)
    .map(({ to, data }) => ({ to, data }));
}

function isMultiSendBatch(args: {
  chainId: string;
  transaction: MultisigTransaction;
  data: Hex;
  multiSendDecoder: MultiSendDecoder;
}): boolean {
  return (
    args.transaction.operation === Operation.DELEGATE &&
    getAllMultiSendDeployments({ chainId: args.chainId }).some((multiSend) =>
      isAddressEqual(multiSend, args.transaction.to),
    ) &&
    args.multiSendDecoder.helpers.isMultiSend(args.data)
  );
}

/**
 * The signing state of a queued transaction, as a pending policy change
 * reports it.
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
    proposer: transaction.proposer,
  };
}
