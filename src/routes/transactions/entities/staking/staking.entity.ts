// TODO: rename to StakingDepositStatus
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

// TODO: rename to StakingDepositStatusInfo
export type StakingStatusInfo = {
  status: StakingStatus;
};

export enum StakingValidatorsExitStatus {
  SignatureNeeded = 'SIGNATURE_NEEDED',
  RequestPending = 'REQUEST_PENDING',
  ReadyToWithdraw = 'READY_TO_WITHDRAW',
}

export type StakingValidatorsExitInfo = {
  status: StakingValidatorsExitStatus;
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
