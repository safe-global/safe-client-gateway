// SPDX-License-Identifier: FSL-1.1-MIT

import type { Address } from 'viem';
import { z } from 'zod';
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const AuthMethod = {
  Siwe: 'siwe',
  Oidc: 'oidc',
} as const;

export const SiweAuthPayloadDtoSchema = z.object({
  auth_method: z.literal(AuthMethod.Siwe),
  sub: NumericStringSchema,
  chain_id: NumericStringSchema,
  signer_address: AddressSchema,
});

export const OidcAuthPayloadDtoSchema = z.object({
  auth_method: z.literal(AuthMethod.Oidc),
  sub: NumericStringSchema,
  // Authentication context copied from the Auth0 ID token at login.
  // amr contains "mfa" when Auth0 performed multi-factor authentication;
  // auth_time (epoch seconds) is when the user last actively authenticated.
  amr: z.array(z.string()).optional(),
  acr: z.string().optional(),
  auth_time: z.number().optional(),
  // Epoch seconds of the last step-up MFA challenge, stamped by CGW at the
  // elevation callback (Auth0's auth_time reflects login, not the challenge).
  mfa_verified_at: z.number().optional(),
});

export const AuthPayloadDtoSchema = z.discriminatedUnion('auth_method', [
  SiweAuthPayloadDtoSchema,
  OidcAuthPayloadDtoSchema,
]);

// Omit `sub` from JwtClaimsSchema to avoid conflict with the auth schemas'
// required NumericString `sub`. Without this, the optional `z.string()` sub
// from JwtClaimsSchema is silently overridden by `.extend()` — which works
// today but depends on Zod's merge-order semantics.
const JwtClaimsWithoutSub = JwtClaimsSchema.omit({ sub: true });

export const AuthPayloadWithClaimsDtoSchema = z.discriminatedUnion(
  'auth_method',
  [
    JwtClaimsWithoutSub.extend(SiweAuthPayloadDtoSchema.shape),
    JwtClaimsWithoutSub.extend(OidcAuthPayloadDtoSchema.shape),
  ],
);

export type AuthPayloadDto = z.infer<typeof AuthPayloadDtoSchema>;
export type AuthPayloadWithClaimsDto = z.infer<
  typeof AuthPayloadWithClaimsDtoSchema
>;
export type SiweAuthPayloadDto = z.infer<typeof SiweAuthPayloadDtoSchema>;
export type OidcAuthPayloadDto = z.infer<typeof OidcAuthPayloadDtoSchema>;

/**
 * Narrowed type for an authenticated AuthPayload where `sub` and
 * `auth_method` are guaranteed to be present. Use the
 * {@link AuthPayload.isAuthenticated} type guard to narrow.
 */
export type AuthenticatedAuthPayload = AuthPayload &
  Required<Pick<AuthPayload, 'sub' | 'auth_method'>>;

export type SiweAuthPayload = AuthenticatedAuthPayload &
  Required<Pick<AuthPayload, 'chain_id' | 'signer_address'>>;

export class AuthPayload {
  sub?: string;
  auth_method?: (typeof AuthMethod)[keyof typeof AuthMethod];
  chain_id?: string;
  signer_address?: Address;
  amr?: Array<string>;
  acr?: string;
  auth_time?: number;
  mfa_verified_at?: number;

  constructor(props?: AuthPayloadDto) {
    this.sub = props?.sub;
    this.auth_method = props?.auth_method;
    if (props?.auth_method === AuthMethod.Siwe) {
      this.chain_id = props.chain_id;
      this.signer_address = props.signer_address;
    }
    if (props?.auth_method === AuthMethod.Oidc) {
      this.amr = props.amr;
      this.acr = props.acr;
      this.auth_time = props.auth_time;
      this.mfa_verified_at = props.mfa_verified_at;
    }
  }

  /**
   * Whether the session was multi-factor authenticated recently enough to
   * perform a sensitive action. mfa_verified_at is stamped by the elevation
   * callback; auth_time is accepted as a fallback for sessions whose initial
   * login already included a fresh MFA challenge.
   */
  hasFreshMfa(maxAgeSeconds: number): boolean {
    const verifiedAt = this.mfa_verified_at ?? this.auth_time;
    return (
      !!this.amr?.includes('mfa') &&
      verifiedAt !== undefined &&
      Date.now() / 1_000 - verifiedAt <= maxAgeSeconds
    );
  }

  /**
   * Type guard that narrows to {@link AuthenticatedAuthPayload},
   * guaranteeing `sub` and `auth_method` are present.
   */
  isAuthenticated(): this is AuthenticatedAuthPayload {
    return this.sub !== undefined && this.auth_method !== undefined;
  }

  getUserId(): string | undefined {
    return this.sub;
  }

  isSiwe(): this is SiweAuthPayload {
    return this.auth_method === AuthMethod.Siwe;
  }

  isOidc(): boolean {
    return this.auth_method === AuthMethod.Oidc;
  }

  isForChain(chainId: string): boolean {
    return !!this.chain_id && this.chain_id === chainId;
  }

  isForSigner(signerAddress: Address): boolean {
    return (
      !!this.signer_address &&
      // Lowercase ensures a mixture of (non-)checksummed addresses are compared correctly
      this.signer_address.toLowerCase() === signerAddress.toLowerCase()
    );
  }
}
