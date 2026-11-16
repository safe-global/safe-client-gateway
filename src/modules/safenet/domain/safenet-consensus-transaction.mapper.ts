// SPDX-License-Identifier: FSL-1.1-MIT
import { type ContractFunctionArgs, zeroAddress } from 'viem';
import type { SafenetProposal } from '#/modules/safenet/domain/entities/safenet-payer.entity';
import type { safenetConsensusAbi } from '#/modules/safenet/domain/safenet-consensus.abi';

/** The `SafeTransaction` struct, derived from the ABI so it cannot drift. */
type SafenetConsensusTransaction = ContractFunctionArgs<
  typeof safenetConsensusAbi,
  'nonpayable',
  'proposeTransaction'
>[2];

/** Maps a proposal to the `SafeTransaction` struct that Consensus hashes and stores. */
export function toSafenetConsensusTransaction({
  chainId,
  safe,
  transaction,
}: SafenetProposal): SafenetConsensusTransaction {
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
