import type { z } from 'zod';
import type { DeletedMultisigTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/deleted-multisig-transaction.schema';

export type DeletedMultisigTransaction = z.infer<
  typeof DeletedMultisigTransactionEventSchema
>;
