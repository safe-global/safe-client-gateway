import type { ExecutedTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/executed-transaction.schema';
import type { z } from 'zod';

export type ExecutedTransaction = z.infer<
  typeof ExecutedTransactionEventSchema
>;
