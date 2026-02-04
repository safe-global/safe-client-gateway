import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

export const TokenSchema = z.object({
  chainId: z.coerce.string(),
  address: AddressSchema,
  symbol: z.string(),
  decimals: z.number(),
  name: z.string(),
  coinKey: NullableStringSchema,
  logoURI: NullableStringSchema,
  priceUSD: z.string(),
});

export type Token = z.infer<typeof TokenSchema>;
