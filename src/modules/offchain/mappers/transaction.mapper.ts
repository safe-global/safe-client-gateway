// SPDX-License-Identifier: FSL-1.1-MIT
import type { OffchainConfirmation } from '@/modules/offchain/entities/multisig-transaction.entity';
import type { OffchainMultisigTransactionEntity } from '@/modules/offchain/entities/multisig-transaction.entity';
import type { Confirmation } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';

function mapConfirmation(confirmation: OffchainConfirmation): Confirmation {
  return {
    owner: confirmation.owner,
    submissionDate: confirmation.created,
    transactionHash: null,
    signatureType: confirmation.signatureType,
    signature: confirmation.signature,
  };
}

/**
 * Maps a queue service MultisigTransaction to the CGW MultisigTransaction type.
 *
 * Note: `confirmationsRequired` defaults to 0. Callers should override it
 * with the actual threshold from Safe info.
 */
export function mapOffchainToMultisigTransaction(
  queue: OffchainMultisigTransactionEntity,
): MultisigTransaction {
  return {
    safe: queue.safe,
    to: queue.to,
    value: String(queue.value),
    data: queue.data,
    operation: queue.operation,
    gasToken: queue.gasToken,
    safeTxGas: queue.safeTxGas,
    baseGas: queue.baseGas,
    gasPrice: String(queue.gasPrice),
    refundReceiver: queue.refundReceiver,
    nonce: queue.nonce,
    executionDate: null,
    submissionDate: queue.created,
    modified: queue.modified,
    blockNumber: null,
    transactionHash: queue.txHash,
    safeTxHash: queue.safeTxHash,
    proposer: queue.proposer,
    proposedByDelegate: queue.proposedByDelegate,
    executor: null,
    isExecuted: queue.txHash !== null,
    isSuccessful: queue.failed === null ? null : !queue.failed,
    ethGasPrice: null,
    gasUsed: null,
    fee: null,
    origin: JSON.stringify({
      name: queue.originName,
      url: queue.originUrl,
    }),
    confirmationsRequired: 0,
    confirmations: queue.confirmations
      ? queue.confirmations.map(mapConfirmation)
      : null,
    signatures: null,
    trusted: true,
  };
}
