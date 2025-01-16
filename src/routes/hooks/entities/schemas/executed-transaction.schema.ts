import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const ExecutedTransactionEventSchema = z.object({
  type: z.literal(TransactionEventType.EXECUTED_MULTISIG_TRANSACTION),
  to: AddressSchema,
  address: AddressSchema,
  chainId: z.string(),
  safeTxHash: z.string(),
  txHash: z.string(),
  failed: z.union([z.literal('true'), z.literal('false')]),
});

export type ExecutedTransactionEvent = z.infer<
  typeof ExecutedTransactionEventSchema
>;
