import { z } from 'zod';
import { ChainIdsSchema } from '@/modules/portfolio/schemas/chain-ids.schema';

const BooleanStringSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (val === undefined || val === '') return true;
    return val === 'true';
  })
  .pipe(z.boolean());

export const GetPortfolioDtoSchema = z.object({
  fiatCode: z.string().optional().default('USD'),
  chainIds: ChainIdsSchema,
  trusted: BooleanStringSchema,
  excludeDust: BooleanStringSchema,
});

export type GetPortfolioDto = z.infer<typeof GetPortfolioDtoSchema>;
