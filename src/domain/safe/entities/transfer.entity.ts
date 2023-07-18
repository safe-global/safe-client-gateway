export interface Transfer {
  blockNumber: number;
  executionDate: Date;
  from: string;
  to: string;
  transactionHash: string;
  transferId: string;
}

const hasTokenAddress = (
  transfer: Transfer,
): transfer is Transfer & {
  tokenAddress: (ERC20Transfer | ERC721Transfer)['tokenAddress'];
} => {
  return 'tokenAddress' in transfer && transfer.tokenAddress != null;
};

const hasValue = (
  transfer: Transfer,
): transfer is Transfer & {
  value: (ERC20Transfer | NativeTokenTransfer)['value'];
} => {
  return 'value' in transfer && transfer.value != null;
};

const hasTokenId = (
  transfer: Transfer,
): transfer is Transfer & {
  tokenId: ERC721Transfer['tokenId'];
} => {
  return 'tokenId' in transfer && transfer.tokenId != null;
};

export interface ERC20Transfer extends Transfer {
  tokenAddress: string;
  value: string;
}

export function isERC20Transfer(transfer: Transfer): transfer is ERC20Transfer {
  return hasTokenAddress(transfer) && hasValue(transfer);
}

export interface ERC721Transfer extends Transfer {
  tokenAddress: string;
  tokenId: string;
}

export function isERC721Transfer(
  transfer: Transfer,
): transfer is ERC721Transfer {
  return hasTokenAddress(transfer) && hasTokenId(transfer);
}

export interface NativeTokenTransfer extends Transfer {
  value: string;
}

export function isNativeTokenTransfer(
  transfer: Transfer,
): transfer is NativeTokenTransfer {
  return !hasTokenAddress(transfer) && hasValue(transfer);
}
