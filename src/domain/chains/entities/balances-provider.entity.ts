import { BalancesProviderSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { z } from 'zod';

export type BalancesProvider = z.infer<typeof BalancesProviderSchema>;
