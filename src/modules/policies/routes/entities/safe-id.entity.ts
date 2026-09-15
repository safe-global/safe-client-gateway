// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { z } from 'zod';
import { CHAIN_ID_MAXLENGTH } from '@/routes/common/constants';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

/**
 * A Safe identified across chains, as the wallet passes it: `{chainId}:{address}`.
 *
 * Note: a lower-cased address is accepted and checksummed, mirroring every other
 * address in a CGW route. Anything else that is not a valid address is rejected
 * with a 422 by the `ValidationPipe`.
 */
export const SafeIdSchema = z.string().transform((value, ctx) => {
  const parts = value.split(':');

  if (parts.length !== 2) {
    ctx.addIssue({
      code: 'custom',
      message: 'Invalid Safe identifier, expected {chainId}:{address}',
    });
    return z.NEVER;
  }

  const [chainId, address] = parts;
  const parsed = z
    .object({
      chainId: NumericStringSchema.max(CHAIN_ID_MAXLENGTH),
      address: AddressSchema,
    })
    .safeParse({ chainId, address });

  if (!parsed.success) {
    // Re-raised as one issue per failure, so the 422 body points at the part of
    // the identifier that is wrong.
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: 'custom',
        path: issue.path,
        message: issue.message,
      });
    }
    return z.NEVER;
  }

  return parsed.data as { chainId: string; address: Address };
});

export type SafeId = z.infer<typeof SafeIdSchema>;

/**
 * A comma-separated list of Safe identifiers, as the Space-level route accepts
 * them: `?safes=11155111:0xAAA,137:0xBBB`.
 *
 * A list rather than a body because the read is a `GET` over a resource the
 * Space already names: this only narrows it. One pair is ~53 characters
 * URL-encoded and a Space holds few Safes, so the whole list fits a URL with
 * room to spare.
 */
export const SafeIdsSchema = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(SafeIdSchema).nonempty());

export type SafeIds = z.infer<typeof SafeIdsSchema>;
