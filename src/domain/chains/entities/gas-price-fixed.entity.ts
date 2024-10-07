import type { z } from 'zod';
import type { GasPriceFixedSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type GasPriceFixed = z.infer<typeof GasPriceFixedSchema>;
