import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import type { Address } from 'viem';

export const SiweAuthPayloadDtoSchema = z.object({
  chain_id: NumericStringSchema,
  signer_address: AddressSchema,
  user_id: NumericStringSchema.optional(),
});

export const OidcAuthPayloadDtoSchema = z.object({
  user_id: NumericStringSchema,
});

export const AuthPayloadDtoSchema = z.union([
  SiweAuthPayloadDtoSchema,
  OidcAuthPayloadDtoSchema,
]);

export type SiweAuthPayloadDto = z.infer<typeof SiweAuthPayloadDtoSchema>;
export type OidcAuthPayloadDto = z.infer<typeof OidcAuthPayloadDtoSchema>;
export type AuthPayloadDto = z.infer<typeof AuthPayloadDtoSchema>;

// All fields are optional to allow `AuthPayload` instances to always be
// returned by the `Auth` decorator, should there not be a payload.
export class AuthPayload {
  chain_id?: string;
  signer_address?: Address;
  user_id?: string;

  constructor(props?: AuthPayloadDto) {
    if (props && 'chain_id' in props) {
      this.chain_id = props.chain_id;
      this.signer_address = props.signer_address;
      this.user_id = props.user_id;
    } else if (props && 'user_id' in props) {
      this.user_id = props.user_id;
    }
  }

  getUserId(): string | undefined {
    return this.user_id;
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
