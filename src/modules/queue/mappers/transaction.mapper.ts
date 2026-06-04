// SPDX-License-Identifier: FSL-1.1-MIT

import type { Hex } from 'viem';
import type {
  QueueConfirmation,
  QueueMultisigTransactionEntity,
} from '@/modules/queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import type {
  Confirmation,
  MultisigTransaction,
} from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';

function mapConfirmation(
  c: QueueConfirmation,
  transactionHash: Hex | null,
): Confirmation {
  return {
    ...c,
    submissionDate: c.created,
    transactionHash,
  };
}

export function mapQueueToMultisigTransaction(
  tx: QueueMultisigTransactionEntity,
  safe: Safe,
): MultisigTransaction {
  return {
    ...tx,
    safeTxGas: tx.safeTxGas ? Number(tx.safeTxGas) : null,
    baseGas: tx.baseGas ? Number(tx.baseGas) : null,
    submissionDate: tx.created,
    transactionHash: tx.txHash,
    isExecuted: tx.txHash !== null,
    isSuccessful: !tx.failed,
    origin: buildOrigin(tx.originName, tx.originUrl, tx.notes),
    executionDate: null,
    blockNumber: null,
    executor: null,
    payment: null,
    ethGasPrice: null,
    gasUsed: null,
    fee: null,
    signatures: null,
    confirmationsRequired: safe.threshold,
    trusted: true,
    confirmations: tx.confirmations?.map((c) => mapConfirmation(c, tx.txHash)),
  };
}
