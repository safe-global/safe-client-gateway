// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { ReorgDetectedEvent } from '@/modules/hooks/routes/entities/schemas/reorg-detected.schema';

export function reorgDetectedEventBuilder(): IBuilder<ReorgDetectedEvent> {
  return new Builder<ReorgDetectedEvent>()
    .with('type', TransactionEventType.REORG_DETECTED)
    .with('chainId', faker.string.numeric())
    .with('blockNumber', faker.number.int());
}
