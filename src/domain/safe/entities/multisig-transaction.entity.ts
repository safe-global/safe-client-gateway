import { Operation } from './operation.entity';

export interface Confirmation {
  owner: string;
  submissionDate: Date;
  transactionHash?: string;
  signatureType: string;
  signature?: string;
}

export type MultisigTransaction = {
  safe: string;
  to: string;
  value?: string;
  data?: string;
  dataDecoded?: any; // TODO will be added under https://github.com/5afe/safe-client-gateway-nest/pull/132
  operation: Operation;
  gasToken?: string;
  safeTxGas?: number;
  baseGas?: number;
  gasPrice?: string;
  refundReceiver?: string;
  nonce: number;
  executionDate?: Date;
  submissionDate?: Date;
  modified?: Date;
  blockNumber?: number;
  transactionHash?: string;
  safeTxHash: string;
  executor?: string;
  isExecuted: boolean;
  isSuccessful?: boolean;
  ethGasPrice?: string;
  gasUsed?: number;
  fee?: string;
  origin?: string;
  confirmationsRequired?: number;
  confirmations?: Confirmation[];
  signatures?: string;
};

export type MultisigTransactionType = MultisigTransaction & {
  txType: 'MULTISIG_TRANSACTION';
};
