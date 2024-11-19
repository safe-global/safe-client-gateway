import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { z } from 'zod';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type {
  DelegateEventPayloadSchema,
  DeletedDelegateEvent,
  NewDelegateEvent,
  UpdatedDelegateEvent,
} from '@/routes/hooks/entities/schemas/delegate-events.schema';

type DelegateEventPayload = z.infer<typeof DelegateEventPayloadSchema>;

function delegateEventBuilder(): IBuilder<DelegateEventPayload> {
  return new Builder<DelegateEventPayload>()
    .with('chainId', faker.string.numeric())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('label', faker.lorem.word())
    .with('expiryDateSeconds', faker.number.int());
}

export function newDelegateEventBuilder(): IBuilder<NewDelegateEvent> {
  return (delegateEventBuilder() as IBuilder<NewDelegateEvent>).with(
    'type',
    TransactionEventType.NEW_DELEGATE,
  );
}

export function updatedDelegateEventBuilder(): IBuilder<UpdatedDelegateEvent> {
  return (delegateEventBuilder() as IBuilder<UpdatedDelegateEvent>).with(
    'type',
    TransactionEventType.UPDATED_DELEGATE,
  );
}

export function deletedDelegateEventBuilder(): IBuilder<DeletedDelegateEvent> {
  return (delegateEventBuilder() as IBuilder<DeletedDelegateEvent>).with(
    'type',
    TransactionEventType.DELETED_DELEGATE,
  );
}
