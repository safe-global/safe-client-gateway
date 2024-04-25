import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export const AuthPayloadSchema = z.object({
  chain_id: NumericStringSchema,
  signer_address: AddressSchema,
});
