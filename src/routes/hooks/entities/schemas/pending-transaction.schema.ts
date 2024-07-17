import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const PendingTransactionEventSchema = z.object({
  type: z.literal(TransactionEventType.PENDING_MULTISIG_TRANSACTION),
  address: AddressSchema,
  chainId: z.string(),
  safeTxHash: z.string(),
});
