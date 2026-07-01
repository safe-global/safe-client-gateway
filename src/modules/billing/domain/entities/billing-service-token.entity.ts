// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';

export const SERVICE_ACCESS_ROLE = 'SERVICE_ACCESS' as const;
export const SERVICE_ACCESS_PERMISSION_TYPE = 'SERVICE_ACCESS' as const;
export const SERVICE_USER_TYPE = 'SERVICE_USER' as const;

/**
 * Service-to-service token presented by the billing service on each webhook
 * call. Extends the standard JWT claims with the authorization markers used to
 * confirm the caller is a service.
 *
 * Cryptographic/standard-claim validation (signature, `iss`, `aud`, `exp`) is
 * handled separately by `IJwtService.verify`. This schema enforces the
 * authorization layer: it is a service token if `roles` contains
 * `SERVICE_ACCESS`, OR `data` carries `permission_type = SERVICE_ACCESS`,
 * `user_type = SERVICE_USER`, and a non-empty `service_name`.
 */
export const BillingServiceTokenSchema = JwtClaimsSchema.extend({
  roles: z.array(z.string()).optional(),
  data: z
    .object({
      service_name: z.string().optional(),
      permission_type: z.string().optional(),
      user_type: z.string().optional(),
    })
    .optional(),
}).superRefine((token, ctx) => {
  const hasServiceRole = token.roles?.includes(SERVICE_ACCESS_ROLE) ?? false;

  const hasServiceData =
    token.data?.permission_type === SERVICE_ACCESS_PERMISSION_TYPE &&
    token.data?.user_type === SERVICE_USER_TYPE &&
    !!token.data?.service_name;

  if (!(hasServiceRole || hasServiceData)) {
    ctx.addIssue({
      code: 'custom',
      message:
        'Not a service token: requires roles to contain SERVICE_ACCESS, or data with permission_type=SERVICE_ACCESS, user_type=SERVICE_USER and a non-empty service_name',
    });
  }
});

export type BillingServiceToken = z.infer<typeof BillingServiceTokenSchema>;
