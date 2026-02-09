import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

export const ContractSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  displayName: z.string(),
  logoUri: NullableStringSchema,
  contractAbi: z.record(z.string(), z.unknown()).nullish().default(null),
  trustedForDelegateCall: z.boolean(),
});
