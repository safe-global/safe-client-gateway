import { z } from 'zod';
import {
  Erc20BalanceSchema,
  FiatSchema,
  NativeBalanceSchema,
} from '@/domain/balances/entities/balance.entity';
import { ZerionApplicationMetadataSchema } from '@/datasources/balances-api/entities/zerion-balance.entity';
import { PositionTypeSchema } from '@/domain/positions/entities/position-type.entity';

export type Position = z.infer<typeof PositionSchema>;

const PositionAttributeSchema = z.object({
  protocol: z.string().nullish().default(null),
  name: z.string(),
  position_type: PositionTypeSchema,
  application_metadata: ZerionApplicationMetadataSchema,
});

export const PositionSchema = z.union([
  NativeBalanceSchema.merge(FiatSchema).merge(PositionAttributeSchema),
  Erc20BalanceSchema.merge(FiatSchema).merge(PositionAttributeSchema),
]);

export const PositionsSchema = z.array(PositionSchema);
