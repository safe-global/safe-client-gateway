import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const OutgoingEtherEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.OUTGOING_ETHER),
  txHash: z.string(),
  value: z.string(),
});
