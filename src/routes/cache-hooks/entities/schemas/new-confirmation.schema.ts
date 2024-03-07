import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const NewConfirmationEventSchema = z.object({
  type: z.literal(EventType.NEW_CONFIRMATION),
  address: AddressSchema,
  chainId: z.string(),
  owner: AddressSchema,
  safeTxHash: z.string(),
});
