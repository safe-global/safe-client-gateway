// SPDX-License-Identifier: FSL-1.1-MIT
import { parseSiweMessage } from 'viem/siwe';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * Returns the authority (host and, if present, port) of {@link uri}, or `null`
 * if it cannot be parsed as a URL.
 */
function getUriAuthority(uri: string): string | null {
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

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
 * @param args.clockSkewSeconds - Tolerated clock skew, in seconds, between the
 * client that produced the message and this server when validating its time
 * bounds (`issuedAt`, `expirationTime`, `notBefore`). Client and server wall
 * clocks are never perfectly aligned, so without a small allowance a
 * freshly-signed message whose `issuedAt` is a few seconds ahead of the server
 * clock would be wrongly rejected as "Message yet issued". This mirrors the
 * leeway used by JWT/OIDC validators. Replay protection and freshness are
 * independently enforced by the single-use, TTL-bound nonce, so this tolerance
 * does not weaken those guarantees.
 * @param args.allowedDomains - Authorities (host, optionally with port) a
 * message may be bound to. An empty list disables the check.
 */
export function buildSiweMessageSchema(args?: {
  clockSkewSeconds?: number;
  allowedDomains?: Array<string>;
}) {
  const allowedDomains = new Set(args?.allowedDomains ?? []);

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
       * EIP-4361 scopes a signature to the origin that requested it, so we
       * only accept a message whose `domain` and `uri` refer to one of the
       * configured origins. The list is empty where the API is used locally or
       * across environments, which disables the check, and is required in
       * deployed environments.
       */
      if (allowedDomains.size > 0) {
        if (!allowedDomains.has(message.domain)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid domain',
          });
        }

        const uriAuthority = getUriAuthority(message.uri);
        if (!(uriAuthority && allowedDomains.has(uriAuthority))) {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid URI',
          });
        }
      }

      const now = Date.now();
      const skewMs = args?.clockSkewSeconds ? args.clockSkewSeconds * 1_000 : 0;

      if (!message.issuedAt || message.issuedAt.getTime() > now + skewMs) {
        ctx.addIssue({
          code: 'custom',
          message: 'Message not yet issued',
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
          message: 'Message not yet valid',
        });
      }

      return z.NEVER;
    });
}
