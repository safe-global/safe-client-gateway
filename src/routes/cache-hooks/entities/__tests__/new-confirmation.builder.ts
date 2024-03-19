import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { NewConfirmation } from '@/routes/cache-hooks/entities/new-confirmation.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function newConfirmationEventBuilder(): IBuilder<NewConfirmation> {
  return new Builder<NewConfirmation>()
    .with('type', EventType.NEW_CONFIRMATION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('safeTxHash', faker.string.hexadecimal());
}
