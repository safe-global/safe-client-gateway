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
  type: z.enum(['ERC20', 'NATIVE_TOKEN']),
});

export const AppPositionSchema = z.object({
  key: z.string(),
  type: z.string(),
  name: z.string(),
  groupId: z.string().nullish().default(null),
  tokenInfo: AppPositionTokenInfoSchema,
  receiptTokenAddress: AddressSchema.nullish().default(null),
  balance: z.string(),
  balanceFiat: FiatStringSchema.nullish().default(null),
  priceChangePercentage1d: PercentageStringSchema.nullish().default(null),
});

export const AppPositionsSchema = z.array(AppPositionSchema);

export const AppPositionGroupSchema = z.object({
  name: z.string(),
  items: AppPositionsSchema,
});

export const AppPositionGroupsSchema = z.array(AppPositionGroupSchema);

export type AppPositionTokenInfo = z.infer<typeof AppPositionTokenInfoSchema>;
export type AppPosition = z.infer<typeof AppPositionSchema>;
export type AppPositions = z.infer<typeof AppPositionsSchema>;
export type AppPositionGroup = z.infer<typeof AppPositionGroupSchema>;
export type AppPositionGroups = z.infer<typeof AppPositionGroupsSchema>;
