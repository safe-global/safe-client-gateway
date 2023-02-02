import { Operation } from './operation.entity';
import { DataDecoded } from '../../data-decoder/entities/data-decoded.entity';

export interface Confirmation {
  owner: string;
  signature: string | null;
  signatureType: string;
  submissionDate: Date;
  transactionHash: string | null;
}

export type MultisigTransaction = {
  baseGas: number | null;
  blockNumber: number | null;
  confirmations: Confirmation[] | null;
  confirmationsRequired: number;
  data: string | null; // TODO will be added under https://github.com/5afe/safe-client-gateway-nest/pull/132
  dataDecoded: DataDecoded | null;
  ethGasPrice: string | null;
  executionDate: Date | null;
  executor: string | null;
  fee: string | null;
  gasPrice: string | null;
  gasToken: string | null;
  gasUsed: number | null;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  modified: Date | null;
  nonce: number;
  operation: Operation;
  origin: string | null;
  refundReceiver: string | null;
  safe: string;
  safeTxGas: number | null;
  safeTxHash: string;
  signatures: string | null;
  submissionDate: Date | null;
  to: string;
  transactionHash: string | null;
  value: string;
};
