import { z } from 'zod';
import { GasPriceOracleSchema } from '@/domain/chains/entities/schemas/chain.schema';

export type GasPriceOracle = z.infer<typeof GasPriceOracleSchema>;
