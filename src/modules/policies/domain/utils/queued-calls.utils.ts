// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, type Hex, isAddressEqual } from 'viem';
import { getAllMultiSendDeployments } from '#/domain/common/utils/deployments';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import type { ILoggingService } from '#/logging/logging.interface';
import type { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import type { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type { PendingTransaction } from '#/modules/policies/domain/entities/pending-policy.entity';
import {
  type PolicyConfiguration,
  PolicyConfigurationSchema,
} from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

/**
 * Safety cap on the number of pages read from a single Safe's transaction
 * queue to guard against an unbounded loop.
 */
export const MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN = 10;

/**
 * The Safe and its whole transaction queue, capped at
 * {@link MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN} pages. `truncated` when pages
 * remain past the cap, which is logged.
 */
export async function readQueue(args: {
  safeRepository: ISafeRepository;
  loggingService: ILoggingService;
  safe: SafeRef;
}): Promise<{
  safeInfo: Safe;
  transactions: Array<MultisigTransaction>;
  truncated: boolean;
}> {
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

  return { safeInfo, transactions, truncated: next !== null };
}

/** Where a queued call was found, for logging one that does not decode. */
export type QueuedCallContext = { chainId: string; safeTxHash: Hex };

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

  const parsed = PolicyConfigurationSchema.array().safeParse(decoded.args[0]);
  return parsed.success ? parsed.data : null;
}

/** Whether a queued transaction has every confirmation it needs to execute. */
export function isFullySigned(transaction: PendingTransaction): boolean {
  return transaction.confirmations >= transaction.confirmationsRequired;
}
