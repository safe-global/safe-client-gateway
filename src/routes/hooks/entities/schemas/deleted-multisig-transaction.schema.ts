import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const DeletedMultisigTransactionEventSchema = z.object({
  type: z.literal(TransactionEventType.DELETED_MULTISIG_TRANSACTION),
  address: AddressSchema,
  chainId: z.string(),
  safeTxHash: z.string(),
});
