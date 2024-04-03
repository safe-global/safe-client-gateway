import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';

export interface ModuleTransaction {
  blockNumber: number;
  created: Date;
  data: `0x${string}` | null;
  dataDecoded: DataDecoded | null;
  executionDate: Date;
  isSuccessful: boolean;
  module: `0x${string}`;
  moduleTransactionId: string;
  operation: Operation;
  safe: `0x${string}`;
  to: `0x${string}`;
  transactionHash: `0x${string}`;
  value: string | null;
}
