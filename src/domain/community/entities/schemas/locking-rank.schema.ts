import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const LockingRankSchema = z.object({
  holder: AddressSchema,
  position: z.number(),
  lockedAmount: NumericStringSchema,
  unlockedAmount: NumericStringSchema,
  withdrawnAmount: NumericStringSchema,
});

export const LockingRankPageSchema = buildPageSchema(LockingRankSchema);
