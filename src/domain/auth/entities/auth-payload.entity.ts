import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';
import type { Address } from 'viem';

export type AuthPayloadDto = z.infer<typeof AuthPayloadDtoSchema>;

export const AuthPayloadDtoSchema = z.object({
  chain_id: NumericStringSchema,
  signer_address: AddressSchema,
});

// This is Partial in order to allow `AuthPayload` instances to always be returned by
// the `Auth` decorator, should there not be a payload
export class AuthPayload implements Partial<AuthPayloadDto> {
  chain_id?: string;
  signer_address?: Address;

  constructor(props?: AuthPayloadDto) {
    this.chain_id = props?.chain_id;
    this.signer_address = props?.signer_address;
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
