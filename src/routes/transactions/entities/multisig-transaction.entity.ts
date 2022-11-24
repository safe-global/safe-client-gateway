import { ApiProperty } from '@nestjs/swagger';

export class ExecutionInfo {
  type: string;
  nonce: number;
  confirmationsRequired: number;
  confirmationsSubmitted: number;
  missingSigners?: string[];
}

export class TxInfo {
  type: string;
}

export class CustomTxInfo extends TxInfo {
  to: unknown; // TODO:
  dataSize: string;
  value: string;
  methodName: string;
  actionCount: number;
  isCancellation: boolean;
}

export enum TransferDirection {
  Incoming,
  Outgoing,
  Unknown,
}

export class TransferTxInfo extends TxInfo {
  sender: string;
  recipient: string;
  direction: TransferDirection;
  transferInfo: unknown; // TODO: see src/routes/transactions/models/mod.rs:79
}

export class TransactionSummary {
  id: string;
  timestamp?: number;
  txStatus: string;
  txInfo: TxInfo;
  executionInfo: ExecutionInfo;
}

export class MultisigTransaction {
  @ApiProperty()
  type: string;
  @ApiProperty()
  transaction: TransactionSummary;
  @ApiProperty()
  conflictType: string;
}
