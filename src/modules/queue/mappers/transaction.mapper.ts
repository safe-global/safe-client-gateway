// SPDX-License-Identifier: FSL-1.1-MIT
import type { QueueConfirmation } from '@/modules/queue/entities/multisig-transaction.entity';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import type { Confirmation } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';

function mapConfirmation(c: QueueConfirmation): Confirmation {
  return {
    ...c,
    submissionDate: c.created,
    transactionHash: null,
  };
}

/**
 * Maps a queue service MultisigTransaction to the CGW MultisigTransaction type.
 *
 * Note: `confirmationsRequired` defaults to 0. Callers should override it
 * with the actual threshold from Safe info.
 */
export function mapQueueToMultisigTransaction(
  tx: QueueMultisigTransactionEntity,
  safe: Safe,
): MultisigTransaction {
  return {
    ...tx,
    value: String(tx.value),
    safeTxGas: tx.safeTxGas ? Number(tx.safeTxGas) : null,
    baseGas: tx.baseGas ? Number(tx.baseGas) : null,
    gasPrice: tx.gasPrice,
    submissionDate: tx.created,
    modified: tx.modified,
    transactionHash: tx.txHash,
    isExecuted: tx.txHash !== null,
    isSuccessful: !tx.failed,
    origin: buildOrigin(tx.originName, tx.originUrl),
    executionDate: null,
    blockNumber: null,
    executor: null,
    ethGasPrice: null,
    gasUsed: null,
    fee: null,
    signatures: null,
    confirmationsRequired: safe.threshold,
    trusted: true,
    // Map confirmations — only the fields that differ
    confirmations: tx.confirmations?.map(mapConfirmation),
  };
}
