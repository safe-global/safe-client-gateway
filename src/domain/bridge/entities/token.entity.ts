import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const TokenSchema = z.object({
  chainId: z.coerce.string(),
  address: AddressSchema,
  symbol: z.string(),
  decimals: z.number(),
  name: z.string(),
  coinKey: z.string().nullish().default(null),
  logoURI: z.string().nullish().default(null),
  priceUSD: z.string(),
});

export type Token = z.infer<typeof TokenSchema>;
