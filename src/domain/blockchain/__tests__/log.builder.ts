import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { getAddress, Log } from 'viem';

export function logBuilder(): IBuilder<Log> {
  return new Builder<Log>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('blockHash', faker.string.hexadecimal() as `0x${string}`)
    .with('blockNumber', faker.number.bigInt())
    .with('logIndex', faker.number.int())
    .with('removed', false)
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`)
    .with('transactionIndex', faker.number.int())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('topics', []);
}
