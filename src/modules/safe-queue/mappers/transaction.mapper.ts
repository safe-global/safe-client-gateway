// SPDX-License-Identifier: FSL-1.1-MIT

import type { Hex } from 'viem';
import type {
  SafeQueueConfirmation,
  SafeQueueMultisigTransactionEntity,
} from '@/modules/safe-queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/safe-queue/helpers/origin.helper';
import type {
  Confirmation,
  MultisigTransaction,
} from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';

function mapConfirmation(
  c: SafeQueueConfirmation,
  transactionHash: Hex | null,
): Confirmation {
  return {
    ...c,
    submissionDate: c.created,
    transactionHash,
  };
}

export function mapSafeQueueToMultisigTransaction(
  tx: SafeQueueMultisigTransactionEntity,
  safe: Safe,
): MultisigTransaction {
  return {
    ...tx,
    safeTxGas: tx.safeTxGas ? Number(tx.safeTxGas) : null,
    baseGas: tx.baseGas ? Number(tx.baseGas) : null,
    submissionDate: tx.created,
    transactionHash: tx.txHash,
    isExecuted: tx.txHash !== null,
    isSuccessful: tx.failed === null ? null : !tx.failed,
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
