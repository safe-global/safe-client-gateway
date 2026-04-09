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
  // The TX service sends `failed` as a string ('true'/'false'), while the
  // queue service sends it as a boolean. Coerce booleans to strings so the
  // downstream type stays consistent (Firebase data values must be strings).
  failed: z.preprocess(
    (val) => (typeof val === 'boolean' ? String(val) : val),
    z.enum(['true', 'false']),
  ),
  // FirebaseNotification['data'] does not accept null values
  data: z.preprocess((val) => val ?? undefined, HexSchema.optional()),
});

export type ExecutedTransactionEvent = z.infer<
  typeof ExecutedTransactionEventSchema
>;