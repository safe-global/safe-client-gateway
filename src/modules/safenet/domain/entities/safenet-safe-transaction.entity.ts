// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';

/** The user Safe transaction; `chainId` is the user Safe's home chain. */
export type SafenetSafeTransaction = {
  chainId: bigint;
  safe: Address;
  to: Address;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: bigint;
};
