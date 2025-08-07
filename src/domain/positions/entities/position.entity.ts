import { z } from 'zod';
import {
  Erc20BalanceSchema,
  FiatSchema,
  NativeBalanceSchema,
} from '@/domain/balances/entities/balance.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

enum PositionType {
  deposit = 1,
  loan = 2,
  locked = 3,
  staked = 4,
  reward = 5,
  wallet = 6,
  airdrop = 7,
  margin = 8,
  unknown = 9,
}

export type Position = z.infer<typeof PositionSchema>;

const PositionAttributeSchema = z.object({
  protocol: z.string().nullish().default(null),
  name: z.string(),
  position_type: z.enum(getStringEnumKeys(PositionType)),
});

export const PositionSchema = z.union([
  NativeBalanceSchema.merge(FiatSchema).merge(PositionAttributeSchema),
  Erc20BalanceSchema.merge(FiatSchema).merge(PositionAttributeSchema),
]);

export const PositionsSchema = z.array(PositionSchema);
