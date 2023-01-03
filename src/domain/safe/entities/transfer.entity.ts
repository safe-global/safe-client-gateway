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

export function isERC20Transfer(transfer: Transfer): transfer is ERC20Transfer {
  const erc20Transfer = transfer as ERC20Transfer;
  return (
    erc20Transfer.tokenAddress !== undefined &&
    erc20Transfer.tokenAddress !== null &&
    erc20Transfer.value !== undefined &&
    erc20Transfer.value !== null
  );
}

export interface ERC721Transfer extends Transfer {
  tokenAddress: string | null;
  tokenId: string;
}

export function isERC721Transfer(
  transfer: Transfer,
): transfer is ERC721Transfer {
  const erc721Transfer = transfer as ERC721Transfer;
  return (
    erc721Transfer.tokenAddress !== undefined &&
    erc721Transfer.tokenAddress !== null &&
    erc721Transfer.tokenId !== undefined &&
    erc721Transfer.tokenId !== null
  );
}

export interface NativeTokenTransfer extends Transfer {
  value: string;
}

export function isNativeTokenTransfer(
  transfer: Transfer,
): transfer is NativeTokenTransfer {
  const nativeTokenTransfer = transfer as NativeTokenTransfer;
  return (
    nativeTokenTransfer.value !== undefined &&
    nativeTokenTransfer.value !== null
  );
}
