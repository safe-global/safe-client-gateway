import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { type Address, type Hex } from 'viem';

/**
 * Maps decoded transaction data recursively to an array of decoded transactions.
 * Handles execTransaction and multiSend methods by extracting their inner transactions.
 *
 * @param transaction - The decoded transaction data
 * @returns Array of decoded transactions
 */
export function mapDecodedTransactions({
  data,
  dataDecoded,
  operation,
  to,
  value,
}: DecodedTransactionData): Array<DecodedTransactionData> {
  if (dataDecoded?.method === 'execTransaction') {
    const dataParam = dataDecoded.parameters?.[2];

    // Recursively map the execTransaction parameters
    return mapDecodedTransactions({
      data: (dataParam?.value as Hex) ?? '0x',
      dataDecoded: (dataParam?.valueDecoded as DataDecoded) ?? null,
      operation,
      to: dataDecoded.parameters?.[0].value as Address,
      value: dataDecoded.parameters?.[1].value as string,
    });
  }

  if (
    dataDecoded?.method === 'multiSend' &&
    Array.isArray(dataDecoded?.parameters?.[0].valueDecoded)
  ) {
    // Recursively map the multiSend inner transactions
    return dataDecoded.parameters?.[0].valueDecoded.flatMap((tx) =>
      mapDecodedTransactions({
        ...tx,
        data: tx.data ?? '0x',
        dataDecoded: tx.dataDecoded as DataDecoded,
      }),
    );
  }

  // Return the decoded transaction data if it's not a multiSend or execTransaction
  return [{ data, dataDecoded, operation, to, value }];
}
