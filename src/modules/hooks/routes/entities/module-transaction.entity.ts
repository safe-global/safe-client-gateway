import type { ModuleTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/module-transaction.schema';
import type { z } from 'zod';

export type ModuleTransaction = z.infer<typeof ModuleTransactionEventSchema>;
