import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Address } from 'viem';
import { getAddress } from 'viem';

/**
 * Extracts the unique contract addresses and pair it with isDelegateCall flag.
 * In case of multiple interactions with the same contract, if at least one is a delegate call,
 * the flag will be true.
 * @param transactions - The transactions.
 * @param erc20Decoder - The ERC-20 decoder to identify token transfers.
 * @returns The unique contract addresses and isDelegateCall flag.
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

  const result: Record<Address, boolean> = {};

  for (const tx of transactions) {
    const [address, isDelegateCall] = extractContract(tx);
    if (!address) continue;

    result[address] = (result[address] ?? false) || isDelegateCall;
  }
  return Object.entries(result) as Array<[Address, boolean]>;
}
