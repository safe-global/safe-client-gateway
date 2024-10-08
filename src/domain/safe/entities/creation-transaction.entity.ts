import type { CreationTransactionSchema } from '@/domain/safe/entities/schemas/creation-transaction.schema';
import type { z } from 'zod';

export type CreationTransaction = z.infer<typeof CreationTransactionSchema>;
