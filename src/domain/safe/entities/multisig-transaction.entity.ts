import { Operation } from './operation.entity';

export interface Confirmation {
  owner: string;
  signature?: string;
  signatureType: string;
  submissionDate: Date;
  transactionHash?: string;
}

export type MultisigTransaction = {
  baseGas?: number;
  blockNumber?: number;
  confirmations?: Confirmation[];
  confirmationsRequired?: number;
  data?: string; // TODO will be added under https://github.com/5afe/safe-client-gateway-nest/pull/132
  dataDecoded?: any;
  ethGasPrice?: string;
  executionDate?: Date;
  executor?: string;
  fee?: string;
  gasPrice?: string;
  gasToken?: string;
  gasUsed?: number;
  isExecuted: boolean;
  isSuccessful?: boolean;
  modified?: Date;
  nonce: number;
  operation: Operation;
  origin?: string;
  refundReceiver?: string;
  safe: string;
  safeTxGas?: number;
  safeTxHash: string;
  signatures?: string;
  submissionDate?: Date;
  to: string;
  transactionHash?: string;
  value?: string;
};
