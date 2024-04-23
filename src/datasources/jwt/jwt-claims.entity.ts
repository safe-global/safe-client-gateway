import { z } from 'zod';

export type JwtClaims = z.infer<typeof JwtClaimsSchema>;

// Standard claims https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
export const JwtClaimsSchema = z.object({
  iss: z.string().optional(),
  sub: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  nbf: z.number().optional(),
  iat: z.number().optional(),
  jti: z.string().optional(),
});

export type JwtPayloadWithClaims<T> = T & JwtClaims;
