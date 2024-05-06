import { Builder, IBuilder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { SafeCreated } from '@/routes/cache-hooks/entities/safe-created.entity';
import { faker } from '@faker-js/faker';

export function safeCreatedEventBuilder(): IBuilder<SafeCreated> {
  return new Builder<SafeCreated>()
    .with('type', EventType.SAFE_CREATED)
    .with('chainId', faker.string.numeric());
}
