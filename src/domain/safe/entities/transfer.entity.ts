export type Transfer = {
  type: string;
  executionDate: string;
  blockNumber: number;
  transactionHash: string;
  to: string;
  from: string;
};

export interface TokenTransfer extends Transfer {
  type: 'ERC721_TRANSFER' | 'ERC20_TRANSFER';
  tokenId: string;
  tokenAddress?: string;
}

export interface NativeTokenTransfer extends Transfer {
  type: 'ETHER_TRANSFER';
  value: string;
}
