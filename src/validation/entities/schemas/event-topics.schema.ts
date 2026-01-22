import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

//TODO is it important to have custom error messages here?
export const EventTopicsSchema = HexSchema.array().nonempty({
  error: 'No event signature found',
});
