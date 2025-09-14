import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import type { Address, Hex } from 'viem';

export type TransactionData = {
  data: Hex;
  operation: number;
  to: Address;
  value: bigint | string;
};

export type DecodedTransactionData = TransactionData & {
  dataDecoded: DataDecoded | null;
};
