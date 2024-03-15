import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { MessageCreated } from '@/routes/cache-hooks/entities/message-created.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function messageCreatedEventBuilder(): IBuilder<MessageCreated> {
  return new Builder<MessageCreated>()
    .with('type', EventType.MESSAGE_CREATED)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('messageHash', faker.string.hexadecimal());
}
