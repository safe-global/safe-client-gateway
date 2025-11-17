import type { DeletedMultisigTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/deleted-multisig-transaction.schema';
import type { z } from 'zod';

export type DeletedMultisigTransaction = z.infer<
  typeof DeletedMultisigTransactionEventSchema
>;
