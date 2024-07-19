import { IBuilder, Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { NewConfirmation } from '@/routes/hooks/entities/new-confirmation.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function newConfirmationEventBuilder(): IBuilder<NewConfirmation> {
  return new Builder<NewConfirmation>()
    .with('type', TransactionEventType.NEW_CONFIRMATION)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('safeTxHash', faker.string.hexadecimal());
}
