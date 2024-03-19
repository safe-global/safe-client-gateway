import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const OutgoingEtherEventSchema = z.object({
  type: z.literal(EventType.OUTGOING_ETHER),
  address: AddressSchema,
  chainId: z.string(),
  txHash: z.string(),
  value: z.string(),
});
