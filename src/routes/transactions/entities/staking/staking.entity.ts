/**
 * Present in all calls for native/pooled/defi staking
 *
 * TODO: Confirm with design but something like:
 * - Queued: pending
 * - History: entering, active/validating, exiting, awaiting withdrawal, exited/withdrawn
 */
export enum StakingStatus {
  Unknown = 'unknown',
}

export type StakingStatusInfo = {
  status: StakingStatus;
};

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
