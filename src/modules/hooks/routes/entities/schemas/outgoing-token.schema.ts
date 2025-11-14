import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const OutgoingTokenEventSchema = z.object({
  type: z.literal(TransactionEventType.OUTGOING_TOKEN),
  address: AddressSchema,
  chainId: z.string(),
  tokenAddress: AddressSchema,
  txHash: z.string(),
});
