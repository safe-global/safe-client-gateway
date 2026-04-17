import type { z } from 'zod';
import type { CreationTransactionSchema } from '@/modules/safe/domain/entities/schemas/creation-transaction.schema';

export type CreationTransaction = z.infer<typeof CreationTransactionSchema>;
