import { ModuleTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/module-transaction.schema';
import { z } from 'zod';

export type ModuleTransaction = z.infer<typeof ModuleTransactionEventSchema>;
