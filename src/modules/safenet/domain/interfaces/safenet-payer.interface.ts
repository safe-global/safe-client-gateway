// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type * as Tx from '@/modules/safenet/domain/entities/safenet-safe-transaction.entity';

export const ISafenetPayer = Symbol('ISafenetPayer');
export type SafenetPayerResult = {
  userSafeTxHash: Hex;
  requestId: Hex;
  transactionHash: Hex;
  payerNonce: bigint;
};
export interface ISafenetPayer {
  propose(transaction: Tx.SafenetSafeTransaction): Promise<SafenetPayerResult>;
}
