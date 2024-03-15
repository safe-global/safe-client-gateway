import { PendingTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/pending-transaction.schema';
import { z } from 'zod';

export type PendingTransaction = z.infer<typeof PendingTransactionEventSchema>;
