import { z } from 'zod';

export const TokenMetadataSchema = z.object({
  name: z.string(),
  symbol: z.string(),
});

export const TokenDetailsSchema = TokenMetadataSchema.extend({
  decimals: z.number(),
});
