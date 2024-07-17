import { IBuilder, Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { ModuleTransaction } from '@/routes/hooks/entities/module-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function moduleTransactionEventBuilder(): IBuilder<ModuleTransaction> {
  return new Builder<ModuleTransaction>()
    .with('type', TransactionEventType.MODULE_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('module', getAddress(faker.finance.ethereumAddress()))
    .with('txHash', faker.string.hexadecimal());
}
