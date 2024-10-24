import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import type { ReorgDetectedEvent } from '@/routes/hooks/entities/schemas/reorg-detected.schema';
import type { IBuilder } from '@/__tests__/builder';

export function reorgDetectedEventBuilder(): IBuilder<ReorgDetectedEvent> {
  return new Builder<ReorgDetectedEvent>()
    .with('type', TransactionEventType.REORG_DETECTED)
    .with('chainId', faker.string.numeric())
    .with('blockNumber', faker.number.int());
}
