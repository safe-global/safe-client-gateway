import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { ExecutedTransaction } from '@/routes/cache-hooks/entities/executed-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function executedTransactionEventBuilder(): IBuilder<ExecutedTransaction> {
  return new Builder<ExecutedTransaction>()
    .with('type', EventType.EXECUTED_MULTISIG_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('safeTxHash', faker.string.hexadecimal())
    .with('txHash', faker.string.hexadecimal());
}
