import type { BalancesProviderSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import type { z } from 'zod';

export type BalancesProvider = z.infer<typeof BalancesProviderSchema>;
