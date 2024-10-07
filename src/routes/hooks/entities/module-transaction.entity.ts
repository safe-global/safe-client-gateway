import type { ModuleTransactionEventSchema } from '@/routes/hooks/entities/schemas/module-transaction.schema';
import type { z } from 'zod';

export type ModuleTransaction = z.infer<typeof ModuleTransactionEventSchema>;
