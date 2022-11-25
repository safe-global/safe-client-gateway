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

export interface Erc20TransferInfo {
  tokenAddress: string;
  token_name?: string;
  token_symbol?: string;
  logo_uri?: string;
  decimals?: number;
  value: string;
}

export interface Erc721TransferInfo {
  tokenAddress: string;
  tokenId: string;
  token_name?: string;
  token_symbol?: string;
  logo_uri?: string;
}

export interface NativeCoinTransferInfo {
  value: string;
}

export interface SetFallbackHandler {
  type: string;
  handler: AddressInfo;
}

export interface AddOwner {
  type: string;
  owner: AddressInfo;
  threshold: number;
}

export interface RemoveOwner {
  type: string;
  owner: AddressInfo;
  threshold: number;
}

export interface SwapOwner {
  type: string;
  oldOwner: AddressInfo;
  newOwner: AddressInfo;
}

export interface ChangeThreshold {
  type: string;
  threshold: number;
}

export interface ChangeImplementation {
  type: string;
  implementation: AddressInfo;
}

export interface EnableModule {
  type: string;
  module: AddressInfo;
}

export interface DisableModule {
  type: string;
  module: AddressInfo;
}

export interface SetGuard {
  type: string;
  guard: AddressInfo;
}

export interface DeleteGuard {
  type: string;
}

export type SettingsInfo =
  | SetFallbackHandler
  | AddOwner
  | RemoveOwner
  | SwapOwner
  | ChangeThreshold
  | ChangeImplementation
  | EnableModule
  | DisableModule
  | SetGuard
  | DeleteGuard;

export class SettingsChangeTransactionInfo extends TransactionInfo {
  dataDecoded: DataDecoded;
  settingsInfo: SettingsInfo | undefined;
}

export interface TransferTransactionInfo extends TransactionInfo {
  sender: string;
  recipient: string;
  direction: TransferDirection;
  transferInfo: Erc20TransferInfo | Erc721TransferInfo | NativeCoinTransferInfo;
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
