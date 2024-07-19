import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const SafeCreatedEventSchema = z.object({
  type: z.literal(TransactionEventType.SAFE_CREATED),
  chainId: z.string(),
  address: AddressSchema,
  blockNumber: z.number(),
});
