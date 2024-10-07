import type { BalancesProviderSchema } from '@/domain/chains/entities/schemas/chain.schema';
import type { z } from 'zod';

export type BalancesProvider = z.infer<typeof BalancesProviderSchema>;
