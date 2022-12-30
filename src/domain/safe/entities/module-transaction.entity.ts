import { DataDecoded } from '../../data-decoder/entities/data-decoded.entity';
import { Operation } from './operation.entity';

export interface ModuleTransaction {
  blockNumber: number;
  created: string;
  data: string | null;
  dataDecoded: DataDecoded | null;
  executionDate: string;
  isSuccessful: boolean;
  module: string;
  operation: Operation;
  safe: string;
  to: string;
  transactionHash: string;
  value: string;
}
