import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const MessageCreatedEventSchema = z.object({
  type: z.literal(TransactionEventType.MESSAGE_CREATED),
  address: AddressSchema,
  chainId: z.string(),
  messageHash: z.string(),
});
