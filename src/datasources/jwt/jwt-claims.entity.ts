import { z } from 'zod';

export type JwtClaims = z.infer<typeof JwtClaimsSchema>;

function maybeSecondsToDate(seconds?: number): Date | undefined {
  return seconds ? new Date(seconds * 1_000) : undefined;
}

// Standard claims https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
export const JwtClaimsSchema = z.object({
  iss: z.string().optional(),
  sub: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  // All dates are second-based NumericDates
  exp: z.number().optional().transform(maybeSecondsToDate),
  nbf: z.number().optional().transform(maybeSecondsToDate),
  iat: z.number().optional().transform(maybeSecondsToDate),
  jti: z.string().optional(),
});

export type JwtPayloadWithClaims<T> = T & JwtClaims;
