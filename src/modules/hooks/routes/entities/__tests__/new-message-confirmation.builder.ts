import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { NewMessageConfirmation } from '@/modules/hooks/routes/entities/new-message-confirmation.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function newMessageConfirmationEventBuilder(): IBuilder<NewMessageConfirmation> {
  return new Builder<NewMessageConfirmation>()
    .with('type', TransactionEventType.MESSAGE_CONFIRMATION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('messageHash', faker.string.hexadecimal());
}
