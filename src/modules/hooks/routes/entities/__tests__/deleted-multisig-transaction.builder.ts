import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DeletedMultisigTransaction } from '@/modules/hooks/routes/entities/deleted-multisig-transaction.entity';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function deletedMultisigTransactionEventBuilder(): IBuilder<DeletedMultisigTransaction> {
  return new Builder<DeletedMultisigTransaction>()
    .with('type', TransactionEventType.DELETED_MULTISIG_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('safeTxHash', faker.string.hexadecimal());
}
