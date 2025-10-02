import type {
  DecodedExecTransactionData,
  DecodedMultiSendTransactionData,
  DecodedTransactionData,
} from '@/modules/safe-shield/entities/transaction-data.entity';

/**
 * Checks if the decoded transaction data represents a multiSend transaction.
 *
 * @param tx - The decoded transaction data to check
 * @returns True if the transaction is a multiSend transaction
 */
export function isMultiSend(
  tx: DecodedTransactionData,
): tx is DecodedMultiSendTransactionData {
  return (
    tx?.dataDecoded?.method === 'multiSend' &&
    Array.isArray(tx?.dataDecoded?.parameters?.[0].valueDecoded)
  );
}

/**
 * Checks if the decoded transaction data represents an execTransaction call.
 *
 * @param tx - The decoded transaction data to check
 * @returns True if the transaction is an execTransaction call
 */
export function isExecTransaction(
  tx: DecodedTransactionData,
): tx is DecodedExecTransactionData {
  return (
    tx?.dataDecoded?.method === 'execTransaction' &&
    Array.isArray(tx?.dataDecoded?.parameters)
  );
}

/**
 * Extracts all inner transactions from a multiSend DecodedTransactionData object.
 * If it's not a multiSend, returns the transaction itself.
 *
 * @param tx - The multiSend transaction with dataDecoded
 * @returns Array of inner transaction data, or the transaction itself if not a valid multiSend
 */
export function mapMultiSendTransactions(
  tx: DecodedTransactionData,
): Array<DecodedTransactionData> {
  if (isMultiSend(tx)) {
    const [{ valueDecoded: innerTransactions }] = tx.dataDecoded.parameters;

    if (innerTransactions.length > 0) {
      return innerTransactions;
    }
  }

  return [tx];
}

/**
 * Maps decoded transaction data recursively to an array of decoded transactions.
 * Handles execTransaction and multiSend methods by extracting their inner transactions.
 *
 * @param transaction - The decoded transaction data
 * @returns Array of decoded transactions
 */
export function mapDecodedTransactions(
  tx: DecodedTransactionData,
): Array<DecodedTransactionData> {
  if (isExecTransaction(tx)) {
    const parameters = tx.dataDecoded.parameters;

    // Recursively map the execTransaction parameters
    return mapDecodedTransactions({
      to: parameters[0].value,
      value: parameters[1].value,
      data: parameters[2].value,
      dataDecoded: parameters[2].valueDecoded,
      operation: Number(parameters[3].value),
    });
  }

  if (isMultiSend(tx)) {
    // Recursively map the multiSend inner transactions
    const [{ valueDecoded: innerTransactions }] = tx.dataDecoded.parameters;

    if (innerTransactions.length > 0) {
      return innerTransactions.flatMap((innerTx: DecodedTransactionData) =>
        mapDecodedTransactions(innerTx),
      );
    }
  }

  // Return the decoded transaction data if it's not a multiSend or execTransaction
  return [tx];
}
