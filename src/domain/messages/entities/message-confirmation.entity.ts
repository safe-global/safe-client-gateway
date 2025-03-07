import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { SignatureLikeSchema } from '@/validation/entities/schemas/signature.schema';
import { z } from 'zod';

export type MessageConfirmation = z.infer<typeof MessageConfirmationSchema>;

export const MessageConfirmationSchema = z.object({
  created: z.coerce.date(),
  modified: z.coerce.date(),
  owner: AddressSchema,
  signature: SignatureLikeSchema,
  signatureType: z.nativeEnum(SignatureType),
});
