import { z } from 'zod';
import { NullableAddressSchema } from '@/validation/entities/schemas/nullable.schema';

export const DeleteDelegateV2DtoSchema = z
  .object({
    delegator: NullableAddressSchema,
    safe: NullableAddressSchema,
    signature: z.string(),
  })
  .refine((value) => value.delegator || value.safe, {
    error: `At least one of the fields 'safe' or 'delegator' is required`,
  });
