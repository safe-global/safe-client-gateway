import type { z } from 'zod';
import type { GasPriceOracleSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type GasPriceOracle = z.infer<typeof GasPriceOracleSchema>;
