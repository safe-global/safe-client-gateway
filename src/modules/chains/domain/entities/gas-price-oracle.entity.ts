// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { GasPriceOracleSchema } from '#/modules/chains/domain/entities/schemas/chain.schema';

export type GasPriceOracle = z.infer<typeof GasPriceOracleSchema>;
