import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const SafeCreatedEventSchema = z.object({
  type: z.literal(EventType.SAFE_CREATED),
  chainId: z.string(),
  address: AddressSchema,
  blockNumber: z.number(),
});
