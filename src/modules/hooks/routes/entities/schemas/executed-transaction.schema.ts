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
  // Optional on purpose: nothing in cache invalidation reads the execution
  // status, so a missing flag must never reject the event. The queue consumer
  // discards whatever fails validation, which leaves every cache for this Safe,
  // its nonce included, stale until it expires on its own TTL.
  isFailed: z.boolean().optional(),
  // FirebaseNotification['data'] does not accept null values
  data: z.preprocess((val) => val ?? undefined, HexSchema.optional()),
});

export type ExecutedTransactionEvent = z.infer<
  typeof ExecutedTransactionEventSchema
>;
