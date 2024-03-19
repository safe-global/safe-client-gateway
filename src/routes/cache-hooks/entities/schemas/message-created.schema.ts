import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const MessageCreatedEventSchema = z.object({
  type: z.literal(EventType.MESSAGE_CREATED),
  address: AddressSchema,
  chainId: z.string(),
  messageHash: z.string(),
});
