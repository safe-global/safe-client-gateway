import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const ModuleTransactionEventSchema = z.object({
  type: z.literal(TransactionEventType.MODULE_TRANSACTION),
  address: AddressSchema,
  chainId: z.string(),
  module: AddressSchema,
  txHash: z.string(),
});
