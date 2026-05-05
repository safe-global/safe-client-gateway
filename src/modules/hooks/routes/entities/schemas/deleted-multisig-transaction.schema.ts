// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '@/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const DeletedMultisigTransactionEventSchema = HookEventBaseSchema.extend(
  {
    type: z.literal(TransactionEventType.DELETED_MULTISIG_TRANSACTION),
    safeTxHash: z.string(),
  },
);

export type DeletedMultisigTransactionEvent = z.infer<
  typeof DeletedMultisigTransactionEventSchema
>;
