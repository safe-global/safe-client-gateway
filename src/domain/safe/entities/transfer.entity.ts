import { Erc20TransferSchema } from '@/domain/safe/entities/schemas/erc20-transfer.schema';
import { Erc721TransferSchema } from '@/domain/safe/entities/schemas/erc721-transfer.schema';
import { NativeTokenTransferSchema } from '@/domain/safe/entities/schemas/native-token-transfer.schema';
import { TransferSchema } from '@/domain/safe/entities/schemas/transfer.schema';
import { z } from 'zod';

export type Transfer = z.infer<typeof TransferSchema>;

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

export type ERC20Transfer = z.infer<typeof Erc20TransferSchema>;

// TODO: Just check `type` is `"ERC20_TRANSFER"`
export function isERC20Transfer(transfer: Transfer): transfer is ERC20Transfer {
  return hasTokenAddress(transfer) && hasValue(transfer);
}

export type ERC721Transfer = z.infer<typeof Erc721TransferSchema>;

// TODO: Just check `type` is `"ERC721_TRANSFER"`
export function isERC721Transfer(
  transfer: Transfer,
): transfer is ERC721Transfer {
  return hasTokenAddress(transfer) && hasTokenId(transfer);
}

export type NativeTokenTransfer = z.infer<typeof NativeTokenTransferSchema>;

// TODO: Just check `type` is `"ETHER_TRANSFER"`
export function isNativeTokenTransfer(
  transfer: Transfer,
): transfer is NativeTokenTransfer {
  return !hasTokenAddress(transfer) && hasValue(transfer);
}
