export interface Transfer {
  blockNumber: number;
  executionDate: Date;
  from: string;
  to: string;
  transactionHash: string;
}

export interface ERC20Transfer extends Transfer {
  tokenAddress: string | null;
  value: string;
}

export interface ERC721Transfer extends Transfer {
  tokenAddress: string | null;
  tokenId: string;
}

export interface NativeTokenTransfer extends Transfer {
  value: string;
}
