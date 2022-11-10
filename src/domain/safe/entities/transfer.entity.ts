export type Transfer = {
  type: string;
  executionDate: string;
  blockNumber: number;
  transactionHash: string;
  to: string;
  from: string;
};

export interface ERC20Transfer extends Transfer {
  type: 'ERC20_TRANSFER';
  value: string;
  tokenAddress?: string;
}

export interface ERC721Transfer extends Transfer {
  type: 'ERC721_TRANSFER';
  tokenId: string;
  tokenAddress?: string;
}

export interface NativeTokenTransfer extends Transfer {
  type: 'ETHER_TRANSFER';
  value: string;
}
