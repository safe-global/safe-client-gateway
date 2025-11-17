import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { ExecutedTransaction } from '@/modules/hooks/routes/entities/executed-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress, type Hash, type Hex } from 'viem';

export function executedTransactionEventBuilder(): IBuilder<ExecutedTransaction> {
  return new Builder<ExecutedTransaction>()
    .with('type', TransactionEventType.EXECUTED_MULTISIG_TRANSACTION)
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('safeTxHash', faker.string.hexadecimal({ length: 32 }) as Hash)
    .with('txHash', faker.string.hexadecimal({ length: 32 }) as Hash)
    .with('failed', faker.helpers.arrayElement(['true', 'false']))
    .with('data', faker.string.hexadecimal() as Hex);
}
