import { z } from 'zod';
import { ChainIdSchema } from '@/domain/chains/entities/schemas/chain-id.schema';

export const ChainIdsSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    return val
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  })
  .pipe(z.array(ChainIdSchema).optional());

export type ChainIds = z.infer<typeof ChainIdsSchema>;
