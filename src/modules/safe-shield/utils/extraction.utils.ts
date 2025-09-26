import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { uniq } from 'lodash';
import type { Address } from 'viem';
import { getAddress } from 'viem';

/**
 * Extracts the unique contract addresses from transactions.
 * @param transactions - The transactions.
 * @returns The unique contract addresses.
 */
export function extractContracts(
  transactions: Array<DecodedTransactionData>,
  erc20Decoder: Erc20Decoder,
): Array<Address> {
  const extractContract = ({
    dataDecoded,
    data,
    to,
  }: DecodedTransactionData): Address | undefined => {
    // all cases where the transaction is not a contract interaction
    if (
      data === '0x' ||
      !dataDecoded ||
      erc20Decoder.helpers.isTransfer(data) ||
      erc20Decoder.helpers.isTransferFrom(data) ||
      (dataDecoded?.method === 'execTransaction' &&
        dataDecoded?.parameters?.[2].value === '0x')
    ) {
      return undefined;
    }
    return getAddress(to);
  };

  return uniq(
    transactions
      .map((tx) => extractContract(tx))
      .filter((contract) => !!contract),
  );
}
