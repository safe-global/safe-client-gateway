import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const IncomingTokenEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.INCOMING_TOKEN),
  tokenAddress: AddressSchema,
  txHash: z.string(),
});

export type IncomingTokenEvent = z.infer<typeof IncomingTokenEventSchema>;
