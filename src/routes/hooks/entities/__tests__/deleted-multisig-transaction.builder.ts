import { IBuilder, Builder } from '@/__tests__/builder';
import { DeletedMultisigTransaction } from '@/routes/hooks/entities/deleted-multisig-transaction.entity';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function deletedMultisigTransactionEventBuilder(): IBuilder<DeletedMultisigTransaction> {
  return new Builder<DeletedMultisigTransaction>()
    .with('type', TransactionEventType.DELETED_MULTISIG_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('safeTxHash', faker.string.hexadecimal());
}
