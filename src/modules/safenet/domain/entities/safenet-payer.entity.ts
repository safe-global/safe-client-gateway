// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { BaseMultisigTransaction } from '#/domain/common/utils/safe';

/** The user Safe transaction to propose; `chainId` is the user Safe's home chain. */
export type SafenetProposal = {
  chainId: string;
  safe: Address;
  transaction: BaseMultisigTransaction;
};

export type SafenetPayerResult = {
  userSafeTxHash: Hex;
  transactionHash: Hex;
  payerNonce: bigint;
};

export type SafenetRelayedTask = { taskId: string; payerNonce: bigint };
