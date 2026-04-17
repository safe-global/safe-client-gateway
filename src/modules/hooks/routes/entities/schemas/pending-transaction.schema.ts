import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const PendingTransactionEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.PENDING_MULTISIG_TRANSACTION),
  to: AddressSchema,
  safeTxHash: HexSchema,
});

export type PendingTransactionEvent = z.infer<
  typeof PendingTransactionEventSchema
>;
