import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { Operation } from './operation.entity';

export interface ModuleTransaction {
  blockNumber: number;
  created: Date;
  data: string | null;
  dataDecoded: DataDecoded | null;
  executionDate: Date;
  isSuccessful: boolean;
  module: string;
  moduleTransactionId: string;
  operation: Operation;
  safe: string;
  to: string;
  transactionHash: string;
  value: string;
}
