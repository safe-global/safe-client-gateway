import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Address } from 'viem';
import { getAddress } from 'viem';

/**
 * Extracts the unique pairs  of contract addresses and boolean flag isDelegateCall from transactions.
 * @param transactions - The transactions.
 * @returns The unique contract addresses.
 */
export function extractContracts(
  transactions: Array<DecodedTransactionData>,
  erc20Decoder: Erc20Decoder,
): Array<[Address, boolean]> {
  const extractContract = ({
    dataDecoded,
    data,
    to,
    operation,
  }: DecodedTransactionData): [Address | undefined, boolean] => {
    // all cases where the transaction is not a contract interaction
    if (
      data === '0x' ||
      !dataDecoded ||
      erc20Decoder.helpers.isTransfer(data) ||
      erc20Decoder.helpers.isTransferFrom(data) ||
      (dataDecoded?.method === 'execTransaction' &&
        dataDecoded?.parameters?.[2].value === '0x')
    ) {
      return [undefined, false];
    }
    return [getAddress(to), operation === 1 /* DELEGATE_CALL */];
  };

  const uniquePairs = new Map<string, [Address, boolean]>();

  for (const tx of transactions) {
    const [address, isDelegateCall] = extractContract(tx);
    if (!address) continue;

    const key = `${address}:${Number(isDelegateCall)}`;
    if (!uniquePairs.has(key)) uniquePairs.set(key, [address, isDelegateCall]);
  }

  return [...uniquePairs.values()];
}
