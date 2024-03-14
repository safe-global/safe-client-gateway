import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { PendingTransaction } from '@/routes/cache-hooks/entities/pending-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function pendingTransactionEventBuilder(): IBuilder<PendingTransaction> {
  return new Builder<PendingTransaction>()
    .with('type', EventType.PENDING_MULTISIG_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('safeTxHash', faker.string.hexadecimal());
}
