import type { PendingTransactionEventSchema } from '@/routes/hooks/entities/schemas/pending-transaction.schema';
import type { z } from 'zod';

export type PendingTransaction = z.infer<typeof PendingTransactionEventSchema>;
