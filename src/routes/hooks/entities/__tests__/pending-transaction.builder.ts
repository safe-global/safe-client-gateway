import { IBuilder, Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { PendingTransaction } from '@/routes/hooks/entities/pending-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function pendingTransactionEventBuilder(): IBuilder<PendingTransaction> {
  return new Builder<PendingTransaction>()
    .with('type', TransactionEventType.PENDING_MULTISIG_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('safeTxHash', faker.string.hexadecimal());
}
