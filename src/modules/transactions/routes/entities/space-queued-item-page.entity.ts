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

export class SpaceQueueSafeCount extends SpaceQueueSafe {
  @ApiProperty({
    description:
      'Transactions of this Safe on this chain that match every filter but `safes`',
  })
  count!: number;
}

export class SpaceQueueChainCount {
  @ApiProperty()
  chainId!: string;
  @ApiProperty({
    description:
      'Transactions on this chain that match every filter but `chainIds`',
  })
  count!: number;
}

export class SpaceQueueSignerCount {
  @ApiProperty()
  address!: Address;
  @ApiProperty({
    description:
      'Transactions still awaiting this signer that match every filter but `signers`',
  })
  count!: number;
}

export class SpaceQueueCounts {
  @ApiProperty({
    description:
      'Transactions that match every filter but the status ones, the sum of execute, sign, blocked and waiting',
  })
  total!: number;
  @ApiProperty({
    description: 'Fully signed and next in line on their Safe and chain',
  })
  execute!: number;
  @ApiProperty({
    description: 'Awaiting a signature from one of the caller wallets',
  })
  sign!: number;
  @ApiProperty({
    description: 'Fully signed but behind an earlier nonce',
  })
  blocked!: number;
  @ApiProperty({
    description: 'Awaiting signatures from other owners only',
  })
  waiting!: number;
  @ApiProperty({
    description: 'Sharing their nonce with another transaction',
  })
  conflicting!: number;
  @ApiProperty({ description: 'Proposed more than 7 days ago' })
  stale!: number;
  @ApiProperty({
    type: SpaceQueueSafeCount,
    isArray: true,
    description:
      'Every Safe and chain of the queue read, with how many of its transactions match every filter but `safes`',
  })
  safes!: Array<SpaceQueueSafeCount>;
  @ApiProperty({
    type: SpaceQueueChainCount,
    isArray: true,
    description:
      'Every chain of the queue read, with how many of its transactions match every filter but `chainIds`',
  })
  chains!: Array<SpaceQueueChainCount>;
  @ApiProperty({
    type: SpaceQueueSignerCount,
    isArray: true,
    description:
      'Every signer a transaction of the queue read still awaits, with how many of those transactions match every filter but `signers`',
  })
  signers!: Array<SpaceQueueSignerCount>;
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

  @ApiProperty({
    type: SpaceQueueCounts,
    description:
      'Faceted counts of the queue read: each applies every filter but its own. The status counts skip the status filters (`status`, `conflicting`, `stale`); `safes`, `chains` and `signers` skip `safes`, `chainIds` and `signers`. The search narrows every count.',
  })
  counts!: SpaceQueueCounts;
}

/** The queue of a Space as read, before the counts and filters of a request. */
export type SpaceQueue = Omit<SpaceQueuedItemPage, 'counts'>;
