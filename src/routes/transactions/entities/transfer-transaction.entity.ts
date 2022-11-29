import { TransactionInfo } from './multisig-transaction.entity';

export enum TransferDirection {
  Incoming,
  Outgoing,
  Unknown,
}

export interface Erc20TransferInfo {
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  logoUri?: string;
  decimals?: number;
  value: string;
}

export interface Erc721TransferInfo {
  tokenAddress: string;
  tokenId: string;
  tokenName?: string;
  tokenSymbol?: string;
  logoUri?: string;
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
