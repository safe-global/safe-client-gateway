// SPDX-License-Identifier: FSL-1.1-MIT
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

export const EventTopicsSchema = HexSchema.array().nonempty({
  error: 'No event signature found',
});
