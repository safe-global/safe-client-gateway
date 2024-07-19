import { ModuleTransactionEventSchema } from '@/routes/hooks/entities/schemas/module-transaction.schema';
import { z } from 'zod';

export type ModuleTransaction = z.infer<typeof ModuleTransactionEventSchema>;
