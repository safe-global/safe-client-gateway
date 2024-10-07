import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { EthereumTransaction } from '@/domain/safe/entities/ethereum-transaction.entity';
import { getAddress } from 'viem';

export function ethereumTransactionBuilder(): IBuilder<EthereumTransaction> {
  return new Builder<EthereumTransaction>()
    .with('blockNumber', faker.number.int())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('executionDate', faker.date.recent())
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('transfers', [])
    .with('txHash', faker.string.hexadecimal() as `0x${string}`);
}

export function toJson(ethereumTransaction: EthereumTransaction): unknown {
  return {
    ...ethereumTransaction,
    txType: 'ETHEREUM_TRANSACTION',
    executionDate: ethereumTransaction.executionDate.toISOString(),
  };
}
