import { ExecutedTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/executed-transaction.schema';
import { z } from 'zod';

export type ExecutedTransaction = z.infer<
  typeof ExecutedTransactionEventSchema
>;
