import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { NewMessageConfirmation } from '@/routes/cache-hooks/entities/new-message-confirmation.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function newMessageConfirmationEventBuilder(): IBuilder<NewMessageConfirmation> {
  return new Builder<NewMessageConfirmation>()
    .with('type', EventType.MESSAGE_CONFIRMATION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('messageHash', faker.string.hexadecimal());
}
