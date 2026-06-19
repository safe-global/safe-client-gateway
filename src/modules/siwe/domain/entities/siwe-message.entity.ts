// SPDX-License-Identifier: FSL-1.1-MIT
import { parseSiweMessage } from 'viem/siwe';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * viem provides both parseSiweMessage (used here) and validatedSiweMessage
 * functions but the former returns a Partial<SiweMessage> and the latter
 * does not validate issuedAt as of writing this.
 *
 * @see https://github.com/wevm/viem/blob/main/src/utils/siwe/parseSiweMessage.ts
 * @see https://github.com/wevm/viem/blob/main/src/utils/siwe/validateSiweMessage.ts
 *
 * We define our own schema to parse, validate and refine the message to ensure
 * compliance with EIP-4361 according to our requirements, with custom error
 * messages and strict types.
 *
 * @see https://eips.ethereum.org/EIPS/eip-4361
 *
 * @param clockSkewSeconds - Tolerated clock skew, in seconds, between the client
 * that produced the message and this server when validating its time bounds
 * (`issuedAt`, `expirationTime`, `notBefore`). Client and server wall clocks are
 * never perfectly aligned, so without a small allowance a freshly-signed message
 * whose `issuedAt` is a few seconds ahead of the server clock would be wrongly
 * rejected as "Message yet issued". This mirrors the leeway used by JWT/OIDC
 * validators. Replay protection and freshness are independently enforced by the
 * single-use, TTL-bound nonce, so this tolerance does not weaken those
 * guarantees.
 */
export function buildSiweMessageSchema(clockSkewSeconds?: number) {
  return z
    .preprocess(
      (value) => (typeof value === 'string' ? parseSiweMessage(value) : value),
      // We only validate primitives as parseSiweMessage ensures compliance,
      // e.g. scheme, domain and uri should be RFC 3986 compliant.
      z.object({
        scheme: z.string().optional(),
        domain: z.string(),
        address: AddressSchema,
        statement: z.string().optional(),
        uri: z.string(),
        version: z.literal('1'),
        chainId: z.coerce.number(),
        nonce: z.string(),
        issuedAt: z.coerce.date(),
        expirationTime: z.coerce.date().optional(),
        notBefore: z.coerce.date().optional(),
        requestId: z.string().optional(),
        resources: z.array(z.string()).optional(),
      }),
    )
    .superRefine((message, ctx) => {
      /**
       * According to the spec., we should also compare the scheme, domain and uri
       * of the message against the request but as our API is often used either
       * locally or across environments, those checks would fail.
       */
      const now = Date.now();
      const skewMs = clockSkewSeconds ? clockSkewSeconds * 1_000 : 0;

      if (!message.issuedAt || message.issuedAt.getTime() > now + skewMs) {
        ctx.addIssue({
          code: 'custom',
          message: 'Message yet issued',
        });
      }

      if (
        message.expirationTime &&
        message.expirationTime.getTime() <= now - skewMs
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Message has expired',
        });
      }

      if (message.notBefore && message.notBefore.getTime() > now + skewMs) {
        ctx.addIssue({
          code: 'custom',
          message: 'Message yet valid',
        });
      }

      return z.NEVER;
    });
}
