import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ChainUpdate } from '@/modules/hooks/routes/entities/chain-update.entity';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { faker } from '@faker-js/faker';

export function chainUpdateEventBuilder(): IBuilder<ChainUpdate> {
  return new Builder<ChainUpdate>()
    .with('type', ConfigEventType.CHAIN_UPDATE)
    .with('chainId', faker.string.numeric());
}
