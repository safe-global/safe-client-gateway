// SPDX-License-Identifier: FSL-1.1-MIT
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import type { Address } from 'viem';
import { JwtClaimsSchema } from '@/datasources/jwt/jwt-claims.entity';

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

export class AuthPayload {
  sub?: string;
  auth_method?: (typeof AuthMethod)[keyof typeof AuthMethod];
  chain_id?: string;
  signer_address?: Address;

  constructor(props?: AuthPayloadDto) {
    this.sub = props?.sub;
    this.auth_method = props?.auth_method;
    if (props?.auth_method === AuthMethod.Siwe) {
      this.chain_id = props.chain_id;
      this.signer_address = props.signer_address;
    }
  }

  getUserId(): string | undefined {
    return this.sub;
  }

  isSiwe(): boolean {
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
