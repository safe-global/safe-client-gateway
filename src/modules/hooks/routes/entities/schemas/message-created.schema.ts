import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { z } from 'zod';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const MessageCreatedEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.MESSAGE_CREATED),
  messageHash: z.string(),
});

export type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;
