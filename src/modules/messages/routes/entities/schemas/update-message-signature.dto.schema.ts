import { z } from 'zod';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export const UpdateMessageSignatureDtoSchema = z.object({
  signature: SignatureSchema,
});
