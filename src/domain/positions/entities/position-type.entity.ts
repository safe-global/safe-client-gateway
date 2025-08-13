export const PositionType = {
  deposit: 'deposit',
  loan: 'loan',
  locked: 'locked',
  staked: 'staked',
  reward: 'reward',
  wallet: 'wallet',
  airdrop: 'airdrop',
  margin: 'margin',
  unknown: 'unknown',
} as const;

export type PositionType = (typeof PositionType)[keyof typeof PositionType];

export const POSITION_TYPE_VALUES = Object.values(PositionType) as [
  PositionType,
  ...Array<PositionType>,
];
