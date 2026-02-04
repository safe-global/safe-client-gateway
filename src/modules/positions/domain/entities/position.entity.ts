import { z } from 'zod';
import {
  Erc20BalanceSchema,
  FiatSchema,
  NativeBalanceSchema,
} from '@/modules/balances/domain/entities/balance.entity';
import { ZerionApplicationMetadataSchema } from '@/modules/balances/datasources/entities/zerion-balance.entity';
import { PositionTypeSchema } from '@/modules/positions/domain/entities/position-type.entity';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

export type Position = z.infer<typeof PositionSchema>;

const PositionAttributeSchema = z.object({
  protocol: NullableStringSchema,
  name: z.string(),
  position_type: PositionTypeSchema,
  application_metadata: ZerionApplicationMetadataSchema.nullish().default(null),
});

export const PositionSchema = z.union([
  NativeBalanceSchema.extend(FiatSchema.shape).extend(
    PositionAttributeSchema.shape,
  ),
  Erc20BalanceSchema.extend(FiatSchema.shape).extend(
    PositionAttributeSchema.shape,
  ),
]);

export const PositionsSchema = z.array(PositionSchema);
