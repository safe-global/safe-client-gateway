import type { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { isExecTransaction } from '@/modules/safe-shield/utils/transaction-mapping.utils';
import { getAddress, type Address } from 'viem';
import uniq from 'lodash/uniq';

const SET_FALLBACK_HANDLER_METHOD = 'setFallbackHandler';
const PARAM_NAME_HANDLER = 'handler';

/**
 * Represents an extracted contract from a transaction.
 */
export interface ExtractedContract {
  /** The contract address */
  readonly address: Address;
  /** Whether the interaction is a delegate call. */
  readonly isDelegateCall: boolean;
  /** The fallback handler address if the transaction is setting one, undefined otherwise. */
  readonly fallbackHandler?: Address | undefined;
}

/**
 * Extracts the unique contract addresses with their interaction metadata.
 * In case of multiple interactions with the same contract:
 * - If at least one is a delegate call, isDelegateCall will be true
 * - If any transaction sets a fallback handler, the last handler address will be stored
 * @param {Array<DecodedTransactionData>} transactions - The transactions.
 * @param {Erc20Decoder} erc20Decoder - The ERC-20 decoder to identify token transfers.
 * @returns {Array<ExtractedContract>} The unique extracted contracts with their metadata.
 */
export function extractContracts(
  transactions: Array<DecodedTransactionData>,
  erc20Decoder: Erc20Decoder,
): Array<ExtractedContract> {
  const isNonContractInteraction = (tx: DecodedTransactionData): boolean => {
    const { data } = tx;
    return (
      data === '0x' ||
      !data ||
      erc20Decoder.helpers.isTransfer(data) ||
      erc20Decoder.helpers.isTransferFrom(data) ||
      (isExecTransaction(tx) && tx.dataDecoded?.parameters?.[2].value === '0x')
    );
  };

  const contractsByAddress: Map<
    Address,
    { isDelegateCall: boolean; fallbackHandler: Address | undefined }
  > = new Map();

  for (const tx of transactions) {
    if (isNonContractInteraction(tx)) continue;

    const contract: Address = getAddress(tx.to);
    const isDelegateCall = tx.operation === 1;
    const fallbackHandler = isFallbackHandler(tx);

    const existing = contractsByAddress.get(contract) ?? {
      isDelegateCall: false,
      fallbackHandler: undefined,
    };

    contractsByAddress.set(contract, {
      isDelegateCall: existing.isDelegateCall || isDelegateCall,
      fallbackHandler: fallbackHandler ?? existing.fallbackHandler,
    });
  }

  return Array.from(contractsByAddress.entries()).map(
    ([address, { isDelegateCall, fallbackHandler }]) => ({
      address,
      isDelegateCall,
      fallbackHandler,
    }),
  );
}

/**
 * Checks if a transaction is setting a fallback handler and returns the handler address.
 * @param {DecodedTransactionData} tx - The transaction to check.
 * @returns {Address | undefined} The fallback handler address if the transaction is setting one, undefined otherwise.
 */
function isFallbackHandler(tx: DecodedTransactionData): Address | undefined {
  const { dataDecoded } = tx;
  if (dataDecoded?.method !== SET_FALLBACK_HANDLER_METHOD) {
    return undefined;
  }
  const handlerValue = dataDecoded.parameters?.find(
    ({ name }) => name === PARAM_NAME_HANDLER,
  )?.value;

  return typeof handlerValue === 'string'
    ? (handlerValue as Address)
    : undefined;
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
