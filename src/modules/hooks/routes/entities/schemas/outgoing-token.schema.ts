import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const OutgoingTokenEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.OUTGOING_TOKEN),
  tokenAddress: AddressSchema,
  txHash: z.string(),
});
