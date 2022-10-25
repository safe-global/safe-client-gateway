import { Transfer } from './transfer.entity';

export type EthereumTransaction = {
  executionDate: string; // TODO date
  data?: string;
  txHash: string;
  blockNumber: number;
  transfers?: Transfer[];
  from: string;
};

export type EthereumTransactionType = EthereumTransaction & {
  txType: 'ETHEREUM_TRANSACTION';
};
