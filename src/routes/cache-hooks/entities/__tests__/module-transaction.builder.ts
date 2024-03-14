import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { ModuleTransaction } from '@/routes/cache-hooks/entities/module-transaction.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function moduleTransactionEventBuilder(): IBuilder<ModuleTransaction> {
  return new Builder<ModuleTransaction>()
    .with('type', EventType.MODULE_TRANSACTION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('module', getAddress(faker.finance.ethereumAddress()))
    .with('txHash', faker.string.hexadecimal());
}
