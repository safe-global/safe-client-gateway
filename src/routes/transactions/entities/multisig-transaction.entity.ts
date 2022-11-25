import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';

export class ExecutionInfo {
  type: string;
  nonce: number;
  confirmationsRequired: number;
  confirmationsSubmitted: number;
  missingSigners?: string[];
}

export class TransactionInfo {
  type: string;
}

export class CustomTxInfo extends TransactionInfo {
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

export class Erc20TransferInfo {
  tokenAddress: string;
  token_name?: string;
  token_symbol?: string;
  logo_uri?: string;
  decimals?: number;
  value: string;
}

export class Erc721TransferInfo {
  tokenAddress: string;
  tokenId: string;
  token_name?: string;
  token_symbol?: string;
  logo_uri?: string;
}

export class NativeCoinTransferInfo {
  value: string;
}

export class SetFallbackHandler {
  handler: AddressInfo;
}

export class AddOwner {
  owner: AddressInfo;
  threshold: number;
}

export class RemoveOwner {
  owner: AddressInfo;
  threshold: number;
}

export class SwapOwner {
  oldOwner: AddressInfo;
  newOwner: AddressInfo;
}

export class ChangeThreshold {
  threshold: number;
}

export class ChangeImplementation {
  implementation: AddressInfo;
}

export class EnableModule {
  module: AddressInfo;
}

export class DisableModule {
  module: AddressInfo;
}

export class SetGuard {
  guard: AddressInfo;
}

export enum SettingsInfo {
  SetFallbackHandler,
  AddOwner,
  RemoveOwner,
  SwapOwner,
  ChangeThreshold,
  ChangeImplementation,
  EnableModule,
  DisableModule,
  SetGuard,
  DeleteGuard,
}

export enum TransferInfo {
  Erc20TransferInfo,
  Erc721TransferInfo,
  NativeCoinTransferInfo,
}

export class SettingsChangeTransactionInfo extends TransactionInfo {
  dataDecoded: DataDecoded;
  settingsInfo: SettingsInfo;
}

export class TransferTransactionInfo extends TransactionInfo {
  sender: string;
  recipient: string;
  direction: TransferDirection;
  transferInfo: TransferInfo;
}

export class TransactionSummary {
  id: string;
  timestamp?: number;
  txStatus: string;
  txInfo: TransactionInfo;
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
