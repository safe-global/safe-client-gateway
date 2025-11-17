import type { CreationTransactionSchema } from '@/modules/safe/domain/entities/schemas/creation-transaction.schema';
import type { z } from 'zod';

export type CreationTransaction = z.infer<typeof CreationTransactionSchema>;
