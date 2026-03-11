import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import type { Address } from 'viem';

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

export type AuthPayloadDto = z.infer<typeof AuthPayloadDtoSchema>;
export type SiweAuthPayloadDto = z.infer<typeof SiweAuthPayloadDtoSchema>;
export type OidcAuthPayloadDto = z.infer<typeof OidcAuthPayloadDtoSchema>;

/**
 * This is Partial in order to allow `AuthPayload` instances to always be
 * returned by the `Auth` decorator, should there not be a payload.
 */
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
      this.signer_address.toLowerCase() === signerAddress.toLowerCase()
    );
  }
}
