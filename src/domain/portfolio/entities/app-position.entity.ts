import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const FiatStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const PercentageStringSchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const AppPositionTokenInfoSchema = z.object({
  address: AddressSchema.nullish().default(null),
  decimals: z.number(),
  symbol: z.string(),
  name: z.string(),
  logoUri: z.string(),
  chainId: z.string(),
  trusted: z.boolean(),
  type: z.literal('ERC20'),
});

export const AppPositionSchema = z.object({
  key: z.string(),
  type: z.string(),
  name: z.string(),
  tokenInfo: AppPositionTokenInfoSchema,
  balance: z.string(),
  balanceFiat: FiatStringSchema.nullish().default(null),
  priceChangePercentage1d: PercentageStringSchema.nullish().default(null),
});

export const AppPositionsSchema = z.array(AppPositionSchema);

export type AppPositionTokenInfo = z.infer<typeof AppPositionTokenInfoSchema>;
export type AppPosition = z.infer<typeof AppPositionSchema>;
export type AppPositions = z.infer<typeof AppPositionsSchema>;
