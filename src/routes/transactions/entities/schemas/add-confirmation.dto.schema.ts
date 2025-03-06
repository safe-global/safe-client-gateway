import { z } from 'zod';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export const AddConfirmationDtoSchema = z
  .object({
    signature: SignatureSchema,
  })
  .or(
    z.object({
      // Note: mobile proposes signatures under the signedSafeTxHash property
      signedSafeTxHash: SignatureSchema,
    }),
  )
  .transform((data) => {
    return {
      signature: 'signature' in data ? data.signature : data.signedSafeTxHash,
    };
  });
