import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const ContractSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  displayName: z.string(),
  logoUri: z.string().nullable(),
  contractAbi: z.record(z.unknown()).nullable(),
  trustedForDelegateCall: z.boolean(),
});
