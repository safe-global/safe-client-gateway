import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

// TODO: Move to a shared location as used for other entities
export enum SignatureType {
  ContractSignature = 'CONTRACT_SIGNATURE',
  ApprovedHash = 'APPROVED_HASH',
  Eoa = 'EOA',
  EthSign = 'ETH_SIGN',
}

export type MessageConfirmation = z.infer<typeof MessageConfirmationSchema>;

export const MessageConfirmationSchema = z.object({
  created: z.coerce.date(),
  modified: z.coerce.date(),
  owner: AddressSchema,
  signature: HexSchema,
  signatureType: z.nativeEnum(SignatureType),
});
