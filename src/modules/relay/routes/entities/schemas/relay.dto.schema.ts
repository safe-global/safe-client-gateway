// SPDX-License-Identifier: FSL-1.1-MIT

import semver from 'semver';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const RelayDtoSchema = z.object({
  to: AddressSchema,
  data: HexSchema,
  version: z.string().refine((value) => semver.parse(value) !== null, {
    error: 'Invalid semver string',
  }),
  gasLimit: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      try {
        return BigInt(value);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Unable to parse value',
        });
        return z.NEVER;
      }
    }),
  safeTxHash: HexSchema.optional(),
});
