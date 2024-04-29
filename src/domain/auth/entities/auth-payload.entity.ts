import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export type AuthPayloadDto = z.infer<typeof AuthPayloadSchema>;

// This is Partial in order to allow `AuthPayload` instances to always be returned by
// the `Auth` decorator, should there not be a payload
export class AuthPayload implements Partial<AuthPayloadDto> {
  private schema = AuthPayloadSchema;

  chain_id?: string;
  signer_address?: `0x${string}`;

  constructor(props: unknown) {
    const result = this.schema.safeParse(props);

    if (!result.success) {
      return;
    }

    this.chain_id = result.data.chain_id;
    this.signer_address = result.data.signer_address;
  }

  isForChain(chainId: string): boolean {
    return !!this.chain_id && this.chain_id === chainId;
  }

  isForSigner(signerAddress: `0x${string}`): boolean {
    return (
      !!this.signer_address &&
      // Lowercase ensures a mixture of (non-)checksummed addresses are compared correctly
      this.signer_address.toLowerCase() === signerAddress.toLowerCase()
    );
  }
}

export const AuthPayloadSchema = z.object({
  chain_id: NumericStringSchema,
  signer_address: AddressSchema,
});
