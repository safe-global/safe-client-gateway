import type { PricesProviderSchema } from '@/domain/chains/entities/schemas/chain.schema';
import type { z } from 'zod';

export type PricesProvider = z.infer<typeof PricesProviderSchema>;
