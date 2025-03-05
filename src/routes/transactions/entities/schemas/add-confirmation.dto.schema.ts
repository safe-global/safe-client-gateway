import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const AddConfirmationDtoSchema = z
  .object({
    signature: HexSchema,
  })
  .or(
    z.object({
      // Note: mobile proposes signatures under the signedSafeTxHash property
      signedSafeTxHash: HexSchema,
    }),
  )
  .transform((data) => {
    return {
      signature: 'signature' in data ? data.signature : data.signedSafeTxHash,
    };
  });
