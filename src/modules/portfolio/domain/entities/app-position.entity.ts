import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import {
  FiatStringSchema,
  TokenInfoSchema,
} from '@/modules/portfolio/domain/entities/token-info.entity';

export const AppPositionSchema = z.object({
  key: z.string(),
  type: z.string(),
  name: z.string(),
  groupId: z.string().optional(),
  tokenInfo: TokenInfoSchema,
  receiptTokenAddress: AddressSchema.optional(),
  balance: z.string(),
  balanceFiat: FiatStringSchema.optional(),
  priceChangePercentage1d: FiatStringSchema.optional(),
});

export const AppPositionsSchema = z.array(AppPositionSchema);

export const AppPositionGroupSchema = z.object({
  name: z.string(),
  items: AppPositionsSchema,
});

export const AppPositionGroupsSchema = z.array(AppPositionGroupSchema);

export type AppPosition = z.infer<typeof AppPositionSchema>;
export type AppPositions = z.infer<typeof AppPositionsSchema>;
export type AppPositionGroup = z.infer<typeof AppPositionGroupSchema>;
export type AppPositionGroups = z.infer<typeof AppPositionGroupsSchema>;
