import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import type { ExecutedTransaction } from '@/routes/hooks/entities/executed-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function executedTransactionEventBuilder(): IBuilder<ExecutedTransaction> {
  return new Builder<ExecutedTransaction>()
    .with('type', TransactionEventType.EXECUTED_MULTISIG_TRANSACTION)
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with(
      'safeTxHash',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    )
    .with('txHash', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
    .with('failed', faker.helpers.arrayElement(['true', 'false']))
    .with('data', faker.string.hexadecimal() as `0x${string}`);
}
