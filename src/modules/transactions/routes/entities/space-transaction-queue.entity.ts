// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { QueuedItem } from '#/modules/transactions/routes/entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '#/modules/transactions/routes/entities/queued-items/conflict-header-queued-item.entity';
import { LabelQueuedItem } from '#/modules/transactions/routes/entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '#/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';

export class SpaceQueueSafe {
  @ApiProperty()
  chainId!: string;
  @ApiProperty()
  safeAddress!: Address;
}

@ApiExtraModels(
  ConflictHeaderQueuedItem,
  LabelQueuedItem,
  TransactionQueuedItem,
)
export class SpaceQueueChainItems {
  @ApiProperty()
  chainId!: string;

  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(ConflictHeaderQueuedItem) },
      { $ref: getSchemaPath(LabelQueuedItem) },
      { $ref: getSchemaPath(TransactionQueuedItem) },
    ],
    description:
      'Queued items of the Safe on this chain, in nonce order, labelled and grouped by conflict against its nonce there.',
  })
  items!: Array<QueuedItem>;
}

export class SpaceQueueSafeItems {
  @ApiProperty()
  safeAddress!: Address;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Pending transactions of the Safe across its chains',
  })
  count!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "URL of the Safe's next page of pending transactions, or null when this page holds the rest",
  })
  next!: string | null;

  @ApiProperty({
    type: SpaceQueueChainItems,
    isArray: true,
    description:
      'One entry per chain of the Safe in the Space that has pending transactions on this page',
  })
  chains!: Array<SpaceQueueChainItems>;
}

export class SpaceTransactionQueue {
  @ApiProperty({
    type: SpaceQueueSafeItems,
    isArray: true,
    description:
      'First page of pending transactions of each Space Safe that has any, one entry per Safe address across its chains',
  })
  results!: Array<SpaceQueueSafeItems>;

  @ApiProperty({
    type: SpaceQueueSafe,
    isArray: true,
    description:
      'Space Safes whose queue is missing from this response because their Safe information or queue could not be loaded or the Space exceeds the Safes one request can cover.',
  })
  unavailableSafes!: Array<SpaceQueueSafe>;
}
