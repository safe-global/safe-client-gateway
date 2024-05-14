import { PricesProviderSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { z } from 'zod';

export type PricesProvider = z.infer<typeof PricesProviderSchema>;
