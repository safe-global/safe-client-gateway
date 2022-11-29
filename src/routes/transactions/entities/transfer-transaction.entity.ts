import { TransactionInfo } from './multisig-transaction.entity';

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

export interface TransferTransaction extends TransactionInfo {
  sender: string;
  recipient: string;
  direction: TransferDirection;
  transferInfo: Erc20TransferInfo | Erc721TransferInfo | NativeCoinTransferInfo;
}
