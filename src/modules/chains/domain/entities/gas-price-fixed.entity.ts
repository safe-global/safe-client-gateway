import type { z } from 'zod';
import type { GasPriceFixedSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type GasPriceFixed = z.infer<typeof GasPriceFixedSchema>;
