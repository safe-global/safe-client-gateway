import { z } from 'zod';
import { ChainIdsSchema } from '@/modules/portfolio/schemas/chain-ids.schema';

const BooleanStringDefaultTrueSchema = z
  .string()
  .optional()
  .transform((val) => (val === undefined || val === '' ? true : val === 'true'))
  .pipe(z.boolean());

const BooleanStringDefaultFalseSchema = z
  .string()
  .optional()
  .transform((val) => val === 'true')
  .pipe(z.boolean());

export const GetPortfolioDtoSchema = z.object({
  fiatCode: z.string().optional().default('USD'),
  chainIds: ChainIdsSchema,
  trusted: BooleanStringDefaultTrueSchema,
  excludeDust: BooleanStringDefaultTrueSchema,
  sync: BooleanStringDefaultFalseSchema,
});

export type GetPortfolioDto = z.infer<typeof GetPortfolioDtoSchema>;
