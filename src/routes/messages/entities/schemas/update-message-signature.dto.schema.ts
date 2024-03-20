import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const UpdateMessageSignatureDtoSchema = z.object({
  signature: HexSchema,
});
