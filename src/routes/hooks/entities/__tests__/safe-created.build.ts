import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import type { SafeCreated } from '@/routes/hooks/entities/safe-created.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function safeCreatedEventBuilder(): IBuilder<SafeCreated> {
  return new Builder<SafeCreated>()
    .with('type', TransactionEventType.SAFE_CREATED)
    .with('chainId', faker.string.numeric())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('blockNumber', faker.number.int());
}
