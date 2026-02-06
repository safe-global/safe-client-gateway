import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { z } from 'zod';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const SafeCreatedEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.SAFE_CREATED),
  blockNumber: z.number(),
});
