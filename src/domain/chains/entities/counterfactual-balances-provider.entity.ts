import { CounterfactualBalancesProviderSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { z } from 'zod';

export type CounterfactualBalancesProvider = z.infer<
  typeof CounterfactualBalancesProviderSchema
>;
