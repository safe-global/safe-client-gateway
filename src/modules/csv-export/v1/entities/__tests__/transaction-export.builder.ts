// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hash } from 'viem';
import { formatUnits, getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import {
  formatTransactionExportGasFees,
  type TransactionExport,
} from '@/modules/csv-export/v1/entities/transaction-export.entity';

/**
 * Creates a builder for transaction export data
 */
export function transactionExportBuilder(): IBuilder<TransactionExport> {
  return new Builder<TransactionExport>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('amount', faker.number.bigInt().toString())
    .with(
      'assetType',
      faker.helpers.arrayElement(['native', 'erc20', 'erc721']),
    )
    .with('assetAddress', getAddress(faker.finance.ethereumAddress()))
    .with('assetSymbol', faker.finance.currencyCode())
    .with('assetDecimals', faker.number.int({ min: 0, max: 18 }))
    .with('proposerAddress', getAddress(faker.finance.ethereumAddress()))
    .with('proposedAt', faker.date.recent())
    .with('executorAddress', getAddress(faker.finance.ethereumAddress()))
    .with('executedAt', faker.date.recent())
    .with('note', faker.lorem.sentence())
    .with('transactionHash', faker.string.hexadecimal({ length: 64 }) as Hash)
    .with('contractAddress', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.number.int().toString())
    .with('gasToken', getAddress(faker.finance.ethereumAddress()))
    .with('payment', faker.number.bigInt().toString())
    .with('gasTokenSymbol', faker.finance.currencyCode())
    .with('gasTokenDecimals', faker.number.int({ min: 0, max: 18 }));
}

/**
 * Simulates the full two-step transformation applied by the service:
 * schema transform (amount formatting) + gas fees formatting with native currency.
 */
export function transformTransactionExport(
  data: TransactionExport,
  nativeDecimals = 18,
  nativeSymbol = 'ETH',
): TransactionExport {
  const { amount, assetDecimals, ...rest } = data;
  const schemaTransformed: TransactionExport = {
    ...rest,
    assetDecimals,
    amount: formatUnits(BigInt(amount), assetDecimals ?? 0),
  };
  return formatTransactionExportGasFees(
    schemaTransformed,
    nativeDecimals,
    nativeSymbol,
  );
}
