import { DataDecoded } from '../../data-decoder/entities/data-decoded.entity';
import { Operation } from './operation.entity';

export type ModuleTransaction = {
  safe: string;
  to: string;
  value?: string;
  data?: string;
  dataDecoded?: DataDecoded;
  operation: Operation;
  created: string;
  executionDate: string; // TODO Date format
  blockNumber: number;
  isSuccessful: boolean;
  transactionHash: string;
  module: string;
};

export type ModuleTransactionType = ModuleTransaction & {
  txType: 'MODULE_TRANSACTION';
};
