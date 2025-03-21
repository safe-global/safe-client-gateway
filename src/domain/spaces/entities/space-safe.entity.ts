import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import type { SpaceSafe as DbSpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { SpaceSchema } from '@/domain/spaces/entities/space.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export type SpaceSafe = z.infer<typeof SpaceSafeSchema>;

// We need explicitly define ZodType due to recursion
export const SpaceSafeSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    chainId: DbSpaceSafe['chainId'];
    address: DbSpaceSafe['address'];
    space?: DbSpaceSafe['space'];
  }
> = RowSchema.extend({
  chainId: NumericStringSchema,
  address: AddressSchema as z.ZodType<`0x${string}`>,
  space: z.lazy(() => SpaceSchema).optional(),
});
