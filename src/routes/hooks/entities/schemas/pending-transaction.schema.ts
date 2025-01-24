import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const PendingTransactionEventSchema = z.object({
  type: z.literal(TransactionEventType.PENDING_MULTISIG_TRANSACTION),
  to: AddressSchema,
  address: AddressSchema,
  chainId: z.string(),
  safeTxHash: HexSchema,
});

export type PendingTransactionEvent = z.infer<
  typeof PendingTransactionEventSchema
>;
