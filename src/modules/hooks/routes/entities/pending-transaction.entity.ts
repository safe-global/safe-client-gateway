// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { PendingTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/pending-transaction.schema';

export type PendingTransaction = z.infer<typeof PendingTransactionEventSchema>;
