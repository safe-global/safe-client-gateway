import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const IncomingEtherEventSchema = z.object({
  type: z.literal(EventType.INCOMING_ETHER),
  address: AddressSchema,
  chainId: z.string(),
  txHash: z.string(),
  value: z.string(),
});
