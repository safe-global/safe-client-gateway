import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { getAddress, TransactionReceipt } from 'viem';

export function transactionReceiptBuilder(): IBuilder<TransactionReceipt> {
  return new Builder<TransactionReceipt>()
    .with('blockHash', faker.string.hexadecimal() as `0x${string}`)
    .with('blockNumber', faker.number.bigInt())
    .with('cumulativeGasUsed', faker.number.bigInt())
    .with('contractAddress', getAddress(faker.finance.ethereumAddress()))
    .with('effectiveGasPrice', faker.number.bigInt())
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('gasUsed', faker.number.bigInt())
    .with('logs', [])
    .with('logsBloom', faker.string.hexadecimal() as `0x${string}`)
    .with('status', 'success')
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`)
    .with('transactionIndex', faker.number.int())
    .with('type', faker.string.alpha());
}
