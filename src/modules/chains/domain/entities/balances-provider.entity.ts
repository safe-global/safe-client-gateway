import type { z } from 'zod';
import type { BalancesProviderSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type BalancesProvider = z.infer<typeof BalancesProviderSchema>;
