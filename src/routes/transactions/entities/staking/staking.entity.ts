// Present in all calls for native/pooled/defi staking
export enum StakingStatus {
  NotStaked = 'NOT_STAKED',
  Activating = 'ACTIVATING',
  DepositInProgress = 'DEPOSIT_IN_PROGRESS',
  Active = 'ACTIVE',
  ExitRequested = 'EXIT_REQUESTED',
  Exiting = 'EXITING',
  Exited = 'EXITED',
  Slashed = 'SLASHED',
}

// Present in all deposit calls for native/pooled staking
export type StakingTimeInfo = {
  estimatedEntryTime: number;
  estimatedExitTime: number;
  estimatedWithdrawalTime: number;
};

// Present in all deposit calls for native/pooled/defi staking
export type StakingFinancialInfo = {
  fee: number;
  monthlyNrr: number;
  annualNrr: number;
};
