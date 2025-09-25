// import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { Operation } from '@/domain/safe/entities/operation.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Address } from 'viem';
import { getAddress } from 'viem';

/**
 * Extracts the contract address from a transaction.
 * @param tx - The transaction.
 * @returns The contract address or undefined if the transaction is a transfer.
 */
export function extractContract(
  { dataDecoded, data, to, operation }: DecodedTransactionData,
  //   erc20Decoder: Erc20Decoder,
): Address | undefined {
  //TODO implement
  // Native transfer
  if (
    data === '0x' ||
    !dataDecoded
    // || erc20Decoder.helpers.isTransfer(data)
  ) {
    return undefined;
  }
  if ((operation as Operation) === Operation.DELEGATE) return getAddress(to);

  // // ExecTransaction with no data is a transfer
  // if (
  //   dataDecoded?.method === 'execTransaction' &&
  //   dataDecoded?.parameters?.[2].value === '0x'
  // ) {
  //   return getAddress(dataDecoded?.parameters?.[0].value as string);
  // }

  // // ERC-20 transfer
  // if (this.erc20Decoder.helpers.isTransfer(data)) {
  //   return getAddress(dataDecoded?.parameters?.[0].value as string);
  // }

  // // ERC-20 transferFrom
  // if (this.erc20Decoder.helpers.isTransferFrom(data)) {
  //   return getAddress(dataDecoded?.parameters?.[1].value as string);
  // }
}
