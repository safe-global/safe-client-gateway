import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { z } from 'zod';

export const DeletedMultisigTransactionEventSchema = HookEventBaseSchema.extend(
  {
    type: z.literal(TransactionEventType.DELETED_MULTISIG_TRANSACTION),
    safeTxHash: z.string(),
  },
);

export type DeletedMultisigTransactionEvent = z.infer<
  typeof DeletedMultisigTransactionEventSchema
>;
