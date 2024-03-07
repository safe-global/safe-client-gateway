import { DeletedMultisigTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/deleted-multisig-transaction.schema';
import { z } from 'zod';

export type DeletedMultisigTransaction = z.infer<
  typeof DeletedMultisigTransactionEventSchema
>;
