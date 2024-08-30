// Present in all calls for native/pooled/defi staking
export enum StakingStatus {
  AwaitingEntry = 'AWAITING_ENTRY',
  AwaitingExecution = 'AWAITING_EXECUTION',
  RequestedExit = 'REQUESTED_EXIT',
  SignatureNeeded = 'SIGNATURE_NEEDED',
  ValidationStarted = 'VALIDATION_STARTED',
  Withdrawn = 'WITHDRAWN',
  Unknown = 'UNKNOWN',
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
