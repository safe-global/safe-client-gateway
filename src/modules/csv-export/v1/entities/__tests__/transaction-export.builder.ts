import { faker } from '@faker-js/faker';
import { formatUnits, getAddress } from 'viem';
import type { Hex } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { TransactionExport } from '@/modules/csv-export/v1/entities/transaction-export.entity';

export type TransactionExportRaw = Omit<TransactionExport, 'from'> & {
  from_: `0x${string}`;
};
/**
 * Creates a builder for raw transaction export data with from_ field (before schema transformation)
 */
export function transactionExportRawBuilder(): IBuilder<TransactionExportRaw> {
  return new Builder<TransactionExportRaw>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('from_', getAddress(faker.finance.ethereumAddress()))
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
    .with('safeTxHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('contractAddress', getAddress(faker.finance.ethereumAddress()));
}

/**
 * Creates a builder for transaction export data after schema transformation (with from field)
 */
export function transactionExportBuilder(): IBuilder<TransactionExport> {
  return new Builder<TransactionExport>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('amount', faker.number.bigInt.toString())
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
    .with('safeTxHash', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('contractAddress', getAddress(faker.finance.ethereumAddress()));
}

/**
 * Converts raw transaction export data to final format
 * from_ field to from and the amount conversion
 */
export function convertRawToTransactionExport(
  raw: TransactionExportRaw,
): TransactionExport {
  const { from_, amount, assetDecimals, ...rest } = raw;
  const convertedAmount = formatUnits(BigInt(amount), assetDecimals ?? 0);
  return { ...rest, from: from_, amount: convertedAmount, assetDecimals };
}
