import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const PendingTransactionEventSchema = z.object({
  type: z.literal(EventType.PENDING_MULTISIG_TRANSACTION),
  address: AddressSchema,
  chainId: z.string(),
  safeTxHash: z.string(),
});
