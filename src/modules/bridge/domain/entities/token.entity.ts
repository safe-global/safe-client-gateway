import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';
import { TokenDetailsSchema } from '@/domain/common/schemas/token-metadata.schema';

export const TokenSchema = TokenDetailsSchema.extend({
  chainId: z.coerce.string(),
  address: AddressSchema,
  coinKey: NullableStringSchema,
  logoURI: NullableStringSchema,
  priceUSD: z.string(),
});

export type Token = z.infer<typeof TokenSchema>;
