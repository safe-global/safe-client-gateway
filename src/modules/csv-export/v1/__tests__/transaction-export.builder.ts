import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Hex } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { TransactionExport } from '@/modules/csv-export/v1/transaction-export.entity';

export function transactionExportBuilder(): IBuilder<TransactionExport> {
  return new Builder<TransactionExport>()
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('amount', faker.number.int({ min: 1, max: 1000 }).toString())
    .with(
      'assetType',
      faker.helpers.arrayElement(['native', 'erc20', 'erc721']),
    ) //todo maybe it should just be a random string
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
    .with('method', faker.lorem.word())
    .with('contractAddress', getAddress(faker.finance.ethereumAddress()))
    .with('isExecuted', faker.datatype.boolean());
}
