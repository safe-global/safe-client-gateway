import type { PricesProviderSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import type { z } from 'zod';

export type PricesProvider = z.infer<typeof PricesProviderSchema>;
