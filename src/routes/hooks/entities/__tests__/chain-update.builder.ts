import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ChainUpdate } from '@/routes/hooks/entities/chain-update.entity';
import { ConfigEventType } from '@/routes/hooks/entities/event-type.entity';
import { faker } from '@faker-js/faker';

export function chainUpdateEventBuilder(): IBuilder<ChainUpdate> {
  return new Builder<ChainUpdate>()
    .with('type', ConfigEventType.CHAIN_UPDATE)
    .with('chainId', faker.string.numeric());
}
