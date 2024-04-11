import { z } from 'zod';
import * as semver from 'semver';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

// TODO: Remove default when legacy support is removed
const LEGACY_SUPPORTED_VERSION = '1.3.0';

export const RelayDtoSchema = z.object({
  to: AddressSchema,
  data: HexSchema,
  version: z
    .string()
    .refine((value) => semver.parse(value) !== null, {
      message: 'Invalid semver string',
    })
    .default(LEGACY_SUPPORTED_VERSION),
  gasLimit: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      try {
        return BigInt(value);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unable to parse value',
        });
        return z.NEVER;
      }
    }),
});
