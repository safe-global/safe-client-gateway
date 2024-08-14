import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const PooledStakingStatsSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  symbol: z.string(),
  fee: z.number(),
  total_supply: NumericStringSchema,
  total_underlying_supply: NumericStringSchema,
  total_stakers: z.number(),
  nrr: z.number(),
  grr: z.number(),
  one_year: z.object({
    nrr: z.number(),
    grr: z.number(),
  }),
  six_month: z.object({
    nrr: z.number(),
    grr: z.number(),
  }),
  three_month: z.object({
    nrr: z.number(),
    grr: z.number(),
  }),
  one_month: z.object({
    nrr: z.number(),
    grr: z.number(),
  }),
  one_week: z.object({
    nrr: z.number(),
    grr: z.number(),
  }),
  pools: z.array(
    z.object({
      address: AddressSchema,
      name: z.string(),
      ratio: z.number(),
      commission: z.number(),
      total_deposited: NumericStringSchema,
      factory_address: AddressSchema,
      operator_address: AddressSchema,
    }),
  ),
});

export type PooledStakingStats = z.infer<typeof PooledStakingStatsSchema>;
