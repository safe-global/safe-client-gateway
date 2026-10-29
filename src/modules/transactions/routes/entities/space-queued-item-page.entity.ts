// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { ChainSafeAddress } from '#/modules/safe/domain/entities/chain-safe-address.entity';
import type { QueuedItem } from '#/modules/transactions/routes/entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '#/modules/transactions/routes/entities/queued-items/conflict-header-queued-item.entity';
import { LabelQueuedItem } from '#/modules/transactions/routes/entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '#/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';

export class SpaceQueueSafe implements ChainSafeAddress {
  @ApiProperty()
  chainId!: string;
  @ApiProperty()
  safeAddress!: Address;
}

export type SpaceQueueItems = {
  [safeAddress: Address]: { [chainId: string]: Array<QueuedItem> };
};

@ApiExtraModels(
  ConflictHeaderQueuedItem,
  LabelQueuedItem,
  TransactionQueuedItem,
)
export class SpaceQueuedItemPage {
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Size of the whole queue, which can exceed the items returned when the queue is longer than the pages read',
  })
  count!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Always null: the queue is returned in one response',
  })
  next!: null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Always null: the queue is returned in one response',
  })
  previous!: null;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          oneOf: [
            { $ref: getSchemaPath(ConflictHeaderQueuedItem) },
            { $ref: getSchemaPath(LabelQueuedItem) },
            { $ref: getSchemaPath(TransactionQueuedItem) },
          ],
        },
      },
    },
    example: {
      '{safeAddress}': { '{chainId}': [] },
    },
    description:
      'Queued items, keyed by Safe address and then by chain ID, each list in nonce order.',
  })
  results!: SpaceQueueItems;

  @ApiProperty({
    type: SpaceQueueSafe,
    isArray: true,
    description:
      'Space Safes whose queue is missing from this response because their Safe information could not be loaded or the Space exceeds the Safes one request can cover.',
  })
  unavailableSafes!: Array<SpaceQueueSafe>;
}
