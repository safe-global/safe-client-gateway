import { z } from 'zod';

export const PositionTypes = [
  'deposit',
  'loan',
  'locked',
  'staked',
  'reward',
  'wallet',
  'airdrop',
  'margin',
  'unknown',
] as const;

export const PositionTypeSchema = z.enum(PositionTypes);
export const PositionType = PositionTypeSchema.enum;
