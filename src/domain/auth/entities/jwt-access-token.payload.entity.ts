import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export type JwtAccessTokenPayload = z.infer<typeof JwtAccessTokenPayloadSchema>;

export const JwtAccessTokenPayloadSchema = z.object({
  chain_id: NumericStringSchema,
  signer_address: AddressSchema,
});
