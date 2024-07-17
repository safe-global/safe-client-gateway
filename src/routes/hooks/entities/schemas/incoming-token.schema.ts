import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const IncomingTokenEventSchema = z.object({
  type: z.literal(TransactionEventType.INCOMING_TOKEN),
  address: AddressSchema,
  chainId: z.string(),
  tokenAddress: AddressSchema,
  txHash: z.string(),
});
