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

// Pick only domain fields explicitly. Spreading the queue entity would leak
// queue-only fields (e.g. `created`/`modified` on confirmations, `chainId`/
// `notes`/`originName`/`originUrl` on the transaction) onto objects typed as
// `Confirmation`/`MultisigTransaction` — TypeScript does not flag them
// because object spread bypasses excess property checks.
function mapConfirmation(
  c: SafeQueueConfirmation,
  transactionHash: Hex | null,
): Confirmation {
  return {
    owner: c.owner,
    signature: c.signature,
    signatureType: c.signatureType,
    submissionDate: c.created,
    transactionHash,
  };
}

export function mapSafeQueueToMultisigTransaction(
  tx: SafeQueueMultisigTransactionEntity,
  safe: Safe,
): MultisigTransaction {
  return {
    safe: tx.safe,
    to: tx.to,
    value: tx.value,
    data: tx.data,
    operation: tx.operation,
    gasToken: tx.gasToken,
    gasPrice: tx.gasPrice,
    refundReceiver: tx.refundReceiver,
    proposer: tx.proposer,
    proposedByDelegate: tx.proposedByDelegate,
    nonce: tx.nonce,
    modified: tx.modified,
    safeTxHash: tx.safeTxHash,
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
