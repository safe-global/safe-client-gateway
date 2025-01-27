import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export const ExecutedTransactionEventSchema = z.object({
  type: z.literal(TransactionEventType.EXECUTED_MULTISIG_TRANSACTION),
  to: AddressSchema,
  address: AddressSchema,
  chainId: z.string(),
  safeTxHash: HexSchema,
  txHash: HexSchema,
  failed: z.enum(['true', 'false']),
  data: HexSchema.nullish().transform((val) => {
    if (!val) {
      // FirebaseNotification['data'] does not accept null values
      return undefined;
    }
    return val;
  }),
});

export type ExecutedTransactionEvent = z.infer<
  typeof ExecutedTransactionEventSchema
>;
