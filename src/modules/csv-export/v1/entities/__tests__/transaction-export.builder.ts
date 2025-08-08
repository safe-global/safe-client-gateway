import { faker } from '@faker-js/faker';
import { formatUnits, getAddress } from 'viem';
import type { Hex } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { TransactionExport } from '@/modules/csv-export/v1/entities/transaction-export.entity';

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
    .with('transactionHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('contractAddress', getAddress(faker.finance.ethereumAddress()));
}

/**
 * Transforms transaction export's amount field to user-friendly format
 */
export function transformTransactionExport(
  data: TransactionExport,
): TransactionExport {
  const { amount, assetDecimals, ...rest } = data;
  const convertedAmount = formatUnits(BigInt(amount), assetDecimals ?? 0);
  return { ...rest, amount: convertedAmount, assetDecimals };
}
