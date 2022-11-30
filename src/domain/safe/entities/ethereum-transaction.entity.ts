import { Transfer } from './transfer.entity';

export interface EthereumTransaction {
  blockNumber: number;
  data?: string;
  executionDate: Date;
  from: string;
  transfers?: Transfer[];
  txHash: string;
}
