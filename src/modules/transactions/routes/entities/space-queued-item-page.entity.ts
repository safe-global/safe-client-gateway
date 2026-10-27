// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { QueuedItem } from '#/modules/transactions/routes/entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '#/modules/transactions/routes/entities/queued-items/conflict-header-queued-item.entity';
import { LabelQueuedItem } from '#/modules/transactions/routes/entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '#/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import { Page } from '#/routes/common/entities/page.entity';

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
export class SpaceQueueSafeItems extends SpaceQueueSafe {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(ConflictHeaderQueuedItem) },
      { $ref: getSchemaPath(LabelQueuedItem) },
      { $ref: getSchemaPath(TransactionQueuedItem) },
    ],
  })
  items!: Array<QueuedItem>;
}

export class SpaceQueuedItemPage extends Page<SpaceQueueSafeItems> {
  @ApiProperty({
    type: SpaceQueueSafeItems,
    isArray: true,
    description:
      'Consecutive runs of queued items of one Safe, in nonce order. A Safe can appear in several runs, and a run can continue on the next page.',
  })
  results!: Array<SpaceQueueSafeItems>;

  @ApiProperty({
    type: SpaceQueueSafe,
    isArray: true,
    description:
      'Space Safes whose queue is missing from this response because their Safe information could not be loaded or the Space exceeds the Safes one request can cover.',
  })
  unavailableSafes!: Array<SpaceQueueSafe>;
}
