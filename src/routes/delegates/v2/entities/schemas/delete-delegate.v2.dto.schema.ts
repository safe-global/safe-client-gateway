import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const DeleteDelegateV2DtoSchema = z
  .object({
    delegator: AddressSchema.nullish().default(null),
    safe: AddressSchema.nullish().default(null),
    signature: z.string(),
  })
  .refine(
    (value) => value.delegator || value.safe,
    () => ({
      message: `At least one of the fields 'safe' or 'delegator' is required`,
    }),
  );
