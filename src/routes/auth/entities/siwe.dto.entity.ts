import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export type SiweDto = z.infer<typeof SiweDtoSchema>;

export const SiweDtoSchema = z.object({
  message: z.string(),
  signature: HexSchema,
});
