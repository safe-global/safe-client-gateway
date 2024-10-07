import type { DeletedMultisigTransactionEventSchema } from '@/routes/hooks/entities/schemas/deleted-multisig-transaction.schema';
import type { z } from 'zod';

export type DeletedMultisigTransaction = z.infer<
  typeof DeletedMultisigTransactionEventSchema
>;
