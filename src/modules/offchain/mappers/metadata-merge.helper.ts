// SPDX-License-Identifier: FSL-1.1-MIT
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { OffchainMultisigTransaction } from '@/modules/offchain/offchain.interface';

/**
 * Merges metadata from the queue service into a TX service
 * MultisigTransaction.
 *
 * Queue service provides: proposer, proposedByDelegate, originName,
 * originUrl.
 * TX service provides: everything else (execution data, block info, etc.).
 *
 * The merge is non-destructive: TX service execution fields always win.
 * Queue service metadata wins for proposer, proposedByDelegate, and
 * origin when the queue service has values.
 */
export function mergeTransactionMetadata(
  txServiceTx: MultisigTransaction,
  queueServiceTx: OffchainMultisigTransaction | null,
): MultisigTransaction {
  if (!queueServiceTx) return txServiceTx;

  const origin =
    queueServiceTx.originName || queueServiceTx.originUrl
      ? JSON.stringify({
          name: queueServiceTx.originName,
          url: queueServiceTx.originUrl,
        })
      : txServiceTx.origin;

  return {
    ...txServiceTx,
    proposer: queueServiceTx.proposer ?? txServiceTx.proposer,
    proposedByDelegate:
      queueServiceTx.proposedByDelegate ?? txServiceTx.proposedByDelegate,
    origin,
  };
}
