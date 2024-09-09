// Present in all calls for native/pooled/defi staking
export enum StakingDepositStatus {
  AwaitingEntry = 'AWAITING_ENTRY',
  AwaitingExecution = 'AWAITING_EXECUTION',
  SignatureNeeded = 'SIGNATURE_NEEDED',
  ValidationStarted = 'VALIDATION_STARTED',
}

export type StakingDepositStatusInfo = {
  status: StakingDepositStatus;
};

export enum StakingValidatorsExitStatus {
  AwaitingExecution = 'AWAITING_EXECUTION',
  ReadyToWithdraw = 'READY_TO_WITHDRAW',
  RequestPending = 'REQUEST_PENDING',
  SignatureNeeded = 'SIGNATURE_NEEDED',
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
