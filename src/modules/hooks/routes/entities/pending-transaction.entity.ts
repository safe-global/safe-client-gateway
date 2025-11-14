import type { PendingTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/pending-transaction.schema';
import type { z } from 'zod';

export type PendingTransaction = z.infer<typeof PendingTransactionEventSchema>;
