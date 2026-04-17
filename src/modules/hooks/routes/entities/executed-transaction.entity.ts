import type { z } from 'zod';
import type { ExecutedTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/executed-transaction.schema';

export type ExecutedTransaction = z.infer<
  typeof ExecutedTransactionEventSchema
>;
