// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdsSchema } from '#/modules/portfolio/schemas/chain-ids.schema';

const BooleanStringDefaultTrueSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val !== 'false');

export const GetPortfolioDtoSchema = z.object({
  fiatCode: z.string().optional().default('USD'),
  chainIds: ChainIdsSchema,
  trusted: BooleanStringDefaultTrueSchema,
  excludeDust: BooleanStringDefaultTrueSchema,
});

export type GetPortfolioDto = z.infer<typeof GetPortfolioDtoSchema>;
