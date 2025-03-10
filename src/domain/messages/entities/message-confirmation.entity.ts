import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import { z } from 'zod';

export type MessageConfirmation = z.infer<typeof MessageConfirmationSchema>;

export const MessageConfirmationSchema = z.object({
  created: z.coerce.date(),
  modified: z.coerce.date(),
  owner: AddressSchema,
  // We don't validate signature length as they are on the Transaction Service
  signature: HexBytesSchema,
  signatureType: z.nativeEnum(SignatureType),
});
