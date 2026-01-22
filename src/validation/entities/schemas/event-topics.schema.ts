import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const EventTopicsSchema = HexSchema.array().nonempty({
  error: 'No event signature found',
});
