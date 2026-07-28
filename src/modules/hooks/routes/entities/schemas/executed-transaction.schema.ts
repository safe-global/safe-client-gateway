// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const ExecutedTransactionEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.EXECUTED_MULTISIG_TRANSACTION),
  to: AddressSchema,
  safeTxHash: HexSchema,
  txHash: HexSchema,
  // The Transaction Service moved the execution status from the stringified
  // `failed` to the boolean `isFailed`. Both are optional so that an event from
  // either version parses: the queue consumer discards any event that fails
  // validation, which would leave every cache for this Safe — including its
  // nonce — stale until it expires on its own TTL. Read via
  // `isExecutedTransactionFailed`.
  isFailed: z.boolean().optional(),
  failed: z.enum(['true', 'false']).optional(),
  // FirebaseNotification['data'] does not accept null values
  data: z.preprocess((val) => val ?? undefined, HexSchema.optional()),
});

export type ExecutedTransactionEvent = z.infer<
  typeof ExecutedTransactionEventSchema
>;

/**
 * Resolves the execution status of an executed transaction event across both
 * Transaction Service payload versions.
 *
 * Falls back to `false` when neither field is present: an executed transaction
 * that reports no status is a successful one.
 *
 * @param event - the executed transaction event to read the status from
 * @returns whether the on-chain execution reverted
 */
export function isExecutedTransactionFailed(
  event: Pick<ExecutedTransactionEvent, 'isFailed' | 'failed'>,
): boolean {
  return event.isFailed ?? event.failed === 'true';
}
