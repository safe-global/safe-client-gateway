// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const MessageCreatedEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.MESSAGE_CREATED),
  messageHash: z.string(),
});

export type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;
