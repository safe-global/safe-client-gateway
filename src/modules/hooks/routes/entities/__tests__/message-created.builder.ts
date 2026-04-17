import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { MessageCreated } from '@/modules/hooks/routes/entities/message-created.entity';

export function messageCreatedEventBuilder(): IBuilder<MessageCreated> {
  return new Builder<MessageCreated>()
    .with('type', TransactionEventType.MESSAGE_CREATED)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('messageHash', faker.string.hexadecimal());
}
