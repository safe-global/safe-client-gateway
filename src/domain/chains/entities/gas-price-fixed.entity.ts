import { z } from 'zod';
import { GasPriceFixedSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type GasPriceFixed = z.infer<typeof GasPriceFixedSchema>;
