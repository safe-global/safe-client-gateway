import { z } from 'zod';

export const AddConfirmationDtoSchema = z.object({
  signedSafeTxHash: z.string(),
});
