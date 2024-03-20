import { CreationTransactionSchema } from '@/domain/safe/entities/schemas/creation-transaction.schema';
import { z } from 'zod';

export type CreationTransaction = z.infer<typeof CreationTransactionSchema>;
