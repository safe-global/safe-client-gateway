import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const EventTopicsSchema = HexSchema.array().nonempty(
  'No event signature found',
);
