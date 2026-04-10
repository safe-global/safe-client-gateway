// SPDX-License-Identifier: FSL-1.1-MIT
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Address, Hex } from 'viem';

/** Request payload sent to the fee service to calculate relay fees for a transaction. */
export interface TxFeesRequest {
  to: Address;
  value: string;
  data: Hex;
  operation: Operation;
  numberSignatures: number;
  gasToken: Address;
}
