// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

const Caip10AddressPartsSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

/**
 * An address scoped to the chain it lives on, CAIP-10 shaped:
 * `{chainId}:{address}`.
 *
 * Note: a lower-cased address is accepted and checksummed, mirroring every
 * other address in a CGW route. Anything else that is not a valid address is
 * rejected with a 422 by the `ValidationPipe`.
 */
export const Caip10AddressSchema = z.string().transform((value, ctx) => {
  const parts = value.split(':');

  if (parts.length !== 2) {
    ctx.addIssue({
      code: 'custom',
      message: 'Invalid CAIP-10 address, expected {chainId}:{address}',
    });
    return z.NEVER;
  }

  const [chainId, address] = parts;
  const parsed = Caip10AddressPartsSchema.safeParse({ chainId, address });

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

  return parsed.data;
});

export type Caip10Address = z.infer<typeof Caip10AddressSchema>;

/**
 * A comma-separated list of CAIP-10 addresses, as a cross-chain route accepts
 * them: `?safes=11155111:0xAAA,137:0xBBB`.
 */
export const Caip10AddressesSchema = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(Caip10AddressSchema).nonempty());

export type Caip10Addresses = z.infer<typeof Caip10AddressesSchema>;
