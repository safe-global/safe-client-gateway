import type { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { isExecTransaction } from '@/modules/safe-shield/utils/transaction-mapping.utils';
import { getAddress, type Address } from 'viem';
import uniq from 'lodash/uniq';

/**
 * Extracts the unique contract addresses and pair it with isDelegateCall flag.
 * In case of multiple interactions with the same contract, if at least one is a delegate call,
 * the flag will be true.
 * @param {Array<DecodedTransactionData>} transactions - The transactions.
 * @param {Erc20Decoder} erc20Decoder - The ERC-20 decoder to identify token transfers.
 * @returns {Array<[Address, boolean]>} The unique contract addresses and isDelegateCall flag.
 */
export function extractContracts(
  transactions: Array<DecodedTransactionData>,
  erc20Decoder: Erc20Decoder,
): Array<[Address, boolean]> {
  const extractContract = (
    tx: DecodedTransactionData,
  ): [Address | undefined, boolean] => {
    const { dataDecoded, data, to, operation } = tx;

    // all cases where the transaction is not a contract interaction
    if (
      data === '0x' ||
      !data ||
      erc20Decoder.helpers.isTransfer(data) ||
      erc20Decoder.helpers.isTransferFrom(data) ||
      (isExecTransaction(tx) && dataDecoded?.parameters?.[2].value === '0x')
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

/**
 * Extracts the unique recipients from transactions.
 * @param {Array<DecodedTransactionData>} transactions - The transactions.
 * @param {Erc20Decoder} erc20Decoder - The ERC-20 decoder helper.
 * @returns {Array<Address>} The unique recipient addresses.
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
 * @param {DecodedTransactionData} tx - The transaction.
 * @param {Erc20Decoder} erc20Decoder - The ERC-20 decoder helper.
 * @returns {Address | undefined} The recipient address or undefined if the transaction is not a transfer.
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
