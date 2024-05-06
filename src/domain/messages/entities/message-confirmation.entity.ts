import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export type MessageConfirmation = z.infer<typeof MessageConfirmationSchema>;

export const MessageConfirmationSchema = z.object({
  created: z.coerce.date(),
  modified: z.coerce.date(),
  owner: AddressSchema,
  signature: HexSchema,
  signatureType: z.nativeEnum(SignatureType),
});
