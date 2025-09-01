import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const ContractSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  displayName: z.string(),
  logoUri: z.string().nullish().default(null),
  contractAbi: z.record(z.unknown()).nullish().default(null),
  trustedForDelegateCall: z.boolean(),
});
