// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { ModuleTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/module-transaction.schema';

export type ModuleTransaction = z.infer<typeof ModuleTransactionEventSchema>;
