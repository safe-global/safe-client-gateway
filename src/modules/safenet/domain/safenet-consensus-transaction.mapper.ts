// SPDX-License-Identifier: FSL-1.1-MIT
import { zeroAddress } from 'viem';
import type { SafenetProposal } from '#/modules/safenet/domain/entities/safenet-payer.entity';

/** Maps a proposal to the `SafeTransaction` struct that Consensus hashes and stores. */
export function toSafenetConsensusTransaction({
  chainId,
  safe,
  transaction,
}: SafenetProposal) {
  return {
    chainId: BigInt(chainId),
    safe,
    to: transaction.to,
    value: BigInt(transaction.value),
    data: transaction.data ?? '0x',
    operation: transaction.operation,
    safeTxGas: BigInt(transaction.safeTxGas ?? 0),
    baseGas: BigInt(transaction.baseGas ?? 0),
    gasPrice: BigInt(transaction.gasPrice ?? 0),
    gasToken: transaction.gasToken ?? zeroAddress,
    refundReceiver: transaction.refundReceiver ?? zeroAddress,
    nonce: BigInt(transaction.nonce),
  };
}
