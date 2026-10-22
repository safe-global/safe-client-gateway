// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import type { ILoggingService } from '#/logging/logging.interface';
import type { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import type { PendingTransaction } from '#/modules/policies/domain/entities/pending-policy.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

/**
 * Safety cap on the number of pages read from a single Safe's transaction
 * queue to guard against an unbounded loop.
 */
export const MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN = 10;

/**
 * The whole transaction queue of a Safe, capped at
 * {@link MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN} pages. `truncated` when pages
 * remain past the cap, which is logged.
 */
export async function readQueue(args: {
  safeRepository: ISafeRepository;
  loggingService: ILoggingService;
  safe: SafeRef;
}): Promise<{ transactions: Array<MultisigTransaction>; truncated: boolean }> {
  const safeInfo = await args.safeRepository.getSafe({
    chainId: args.safe.chainId,
    address: args.safe.address,
  });
  const limit = args.safeRepository.getTransactionQueueMaxPageSize();

  const transactions: Array<MultisigTransaction> = [];
  let next: string | null = null;

  for (let page = 0; page < MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN; page++) {
    const queue = await args.safeRepository.getTransactionQueue({
      chainId: args.safe.chainId,
      safe: safeInfo,
      limit,
      offset: page * limit,
    });
    transactions.push(...queue.results);
    next = queue.next;

    if (!next) {
      break;
    }
  }

  if (next) {
    args.loggingService.warn({
      message: 'Truncated a Safe transaction queue at the page cap',
      chainId: args.safe.chainId,
      safeAddress: args.safe.address,
      pages: MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN,
    });
  }

  return { transactions, truncated: next !== null };
}

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
