export type Call = 0;
export type Delegate = 1;
export type Operation = Call | Delegate;

export interface Confirmation {
  owner: string;
  submissionDate: string; // TODO check Date type validation
  transactionHash?: string;
  signatureType: string;
  signature?: string;
}

export interface MultisigTransaction {
  safe: string;
  to: string;
  value?: string;
  data?: string;
  dataDecoded?: unknown; // TODO will be added under https://github.com/5afe/safe-client-gateway-nest/pull/132
  operation: Operation;
  gasToken?: string;
  safeTxGas?: number;
  baseGas?: number;
  gasPrice?: string;
  refundReceiver?: string;
  nonce: number;
  executionDate?: string; // TODO check Date type validation
  submissionDate?: string; // TODO check Date type validation
  modified?: string; // TODO check Date type validation
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
}
