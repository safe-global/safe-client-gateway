import { z } from 'zod';
import {
  Erc20BalanceSchema,
  FiatSchema,
  NativeBalanceSchema,
} from '@/domain/balances/entities/balance.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { ZerionApplicationMetadataSchema } from '@/datasources/balances-api/entities/zerion-balance.entity';

export enum PositionType {
  deposit = 'deposit',
  loan = 'loan',
  locked = 'locked',
  staked = 'staked',
  reward = 'reward',
  wallet = 'wallet',
  airdrop = 'airdrop',
  margin = 'margin',
  unknown = 'unknown',
}

export type Position = z.infer<typeof PositionSchema>;

const PositionAttributeSchema = z.object({
  protocol: z.string().nullish().default(null),
  name: z.string(),
  position_type: z.enum(getStringEnumKeys(PositionType)),
  application_metadata: ZerionApplicationMetadataSchema,
});

export const PositionSchema = z.union([
  NativeBalanceSchema.merge(FiatSchema).merge(PositionAttributeSchema),
  Erc20BalanceSchema.merge(FiatSchema).merge(PositionAttributeSchema),
]);

export const PositionsSchema = z.array(PositionSchema);
