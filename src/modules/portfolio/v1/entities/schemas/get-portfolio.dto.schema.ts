import { z } from 'zod';
import { ChainIdsSchema } from '@/modules/portfolio/schemas/chain-ids.schema';

const BooleanStringDefaultTrueSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val !== 'false');

const BooleanStringDefaultFalseSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val === 'true');

export const GetPortfolioDtoSchema = z.object({
  fiatCode: z.string().optional().default('USD'),
  chainIds: ChainIdsSchema,
  trusted: BooleanStringDefaultTrueSchema,
  excludeDust: BooleanStringDefaultTrueSchema,
  sync: BooleanStringDefaultFalseSchema,
});

export type GetPortfolioDto = z.infer<typeof GetPortfolioDtoSchema>;
