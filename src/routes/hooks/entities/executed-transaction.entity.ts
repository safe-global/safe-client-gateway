import type { ExecutedTransactionEventSchema } from '@/routes/hooks/entities/schemas/executed-transaction.schema';
import type { z } from 'zod';

export type ExecutedTransaction = z.infer<
  typeof ExecutedTransactionEventSchema
>;
