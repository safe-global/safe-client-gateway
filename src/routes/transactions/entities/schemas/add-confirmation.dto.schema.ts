import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const AddConfirmationDtoSchema = z
  .object({
    signature: HexSchema,
  })
  .or(
    // Note: mobile proposes signatures under the signedSafeTxHash property
    z
      .object({
        signedSafeTxHash: HexSchema,
      })
      .transform((data) => {
        return {
          signature: data.signedSafeTxHash,
        };
      }),
  );
