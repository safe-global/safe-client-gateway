import { PendingTransactionEventSchema } from '@/routes/hooks/entities/schemas/pending-transaction.schema';
import { z } from 'zod';

export type PendingTransaction = z.infer<typeof PendingTransactionEventSchema>;
