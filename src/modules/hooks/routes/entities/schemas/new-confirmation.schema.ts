import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const NewConfirmationEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.NEW_CONFIRMATION),
  owner: AddressSchema,
  safeTxHash: z.string(),
});
