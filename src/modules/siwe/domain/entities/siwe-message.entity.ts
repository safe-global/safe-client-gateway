import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { parseSiweMessage } from 'viem/siwe';
import { z } from 'zod';

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
 */
export const SiweMessageSchema = z
  .string()
  .transform(parseSiweMessage)
  .pipe(
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
    const now = new Date();

    if (!message.issuedAt || message.issuedAt > now) {
      ctx.addIssue({
        code: 'custom',
        message: 'Message yet issued',
      });
    }

    if (message.expirationTime && message.expirationTime <= now) {
      ctx.addIssue({
        code: 'custom',
        message: 'Message has expired',
      });
    }

    if (message.notBefore && message.notBefore > now) {
      ctx.addIssue({
        code: 'custom',
        message: 'Message yet valid',
      });
    }

    return z.NEVER;
  });
