import { IBuilder, Builder } from '@/__tests__/builder';
import { ChainUpdate } from '@/routes/cache-hooks/entities/chain-update.entity';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { faker } from '@faker-js/faker';

export function chainUpdateEventBuilder(): IBuilder<ChainUpdate> {
  return new Builder<ChainUpdate>()
    .with('type', EventType.CHAIN_UPDATE)
    .with('chainId', faker.string.numeric());
}
