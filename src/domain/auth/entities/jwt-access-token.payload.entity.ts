import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type JwtAccessTokenPayload = z.infer<typeof JwtAccessTokenPayloadSchema>;

export const JwtAccessTokenPayloadSchema = z.object({
  signer_address: AddressSchema,
});
