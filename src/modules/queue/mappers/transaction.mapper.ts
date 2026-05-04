// SPDX-License-Identifier: FSL-1.1-MIT
import type { QueueConfirmation } from '@/modules/queue/entities/multisig-transaction.entity';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import type { Confirmation } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { Hex } from 'viem';

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
    confirmations: tx.confirmations?.map((c) => mapConfirmation(c, tx.txHash)),
  };
}
