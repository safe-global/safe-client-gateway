import { getAddress, type Address } from 'viem';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import uniq from 'lodash/uniq';
import { isExecTransaction } from '@/modules/safe-shield/utils/transaction-mapping.utils';

/**
 * Extracts the unique recipients from transactions.
 * @param transactions - The transactions.
 * @param erc20Decoder - The ERC-20 decoder helper.
 * @returns The unique recipient addresses.
 */
export function extractRecipients(
  transactions: Array<DecodedTransactionData>,
  erc20Decoder: Erc20Decoder,
): Array<Address> {
  return uniq(
    transactions
      .map((tx) => extractRecipient(tx, erc20Decoder))
      .filter((recipient) => !!recipient),
  );
}

/**
 * Extracts the recipient address from a transaction.
 * @param tx - The transaction.
 * @param erc20Decoder - The ERC-20 decoder helper.
 * @returns The recipient address or undefined if the transaction is not a transfer.
 */
export function extractRecipient(
  tx: DecodedTransactionData,
  erc20Decoder: Erc20Decoder,
): Address | undefined {
  const { dataDecoded, data, to } = tx;

  // ExecTransaction with no data is a transfer
  if (isExecTransaction(tx) && tx.dataDecoded.parameters[2].value === '0x') {
    return getAddress(tx.dataDecoded.parameters[0].value);
  }

  // ERC-20 transfer
  if (!!data && erc20Decoder.helpers.isTransfer(data)) {
    return getAddress(dataDecoded?.parameters?.[0].value as string);
  }

  // ERC-20 transferFrom
  if (!!data && erc20Decoder.helpers.isTransferFrom(data)) {
    return getAddress(dataDecoded?.parameters?.[1].value as string);
  }

  // Native transfer
  if (!data || data === '0x') {
    return getAddress(to);
  }
}
