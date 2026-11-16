// SPDX-License-Identifier: FSL-1.1-MIT
import { parseAbi } from 'viem';

export const safenetConsensusAbi = parseAbi([
  'struct SafeTransaction { uint256 chainId; address safe; address to; uint256 value; bytes data; uint8 operation; uint256 safeTxGas; uint256 baseGas; uint256 gasPrice; address gasToken; address refundReceiver; uint256 nonce; }',
  'function proposeTransaction(address oracle, bytes extraData, SafeTransaction transaction) returns (bytes32 safeTxHash)',
]);
