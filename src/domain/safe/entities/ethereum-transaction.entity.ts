import { Transfer } from './transfer.entity';

export interface EthereumTransaction {
  blockNumber: number;
  data: string | null;
  executionDate: Date;
  from: string;
  transfers: Transfer[] | null;
  txHash: string;
}
