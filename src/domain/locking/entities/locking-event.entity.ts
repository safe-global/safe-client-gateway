export type LockingEvent = LockEvent | UnlockEvent | WithdrawEvent;

export enum LockType {
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
  WITHDRAW = 'WITHDRAW',
}

export type LockEvent = {
  type: LockType.LOCK;
  amount: string;
  executedAt: string;
};

export type UnlockEvent = {
  type: LockType.UNLOCK;
  amount: string;
  executedAt: string;
  unlockIndex: string;
  unlockedAt: string;
};

export type WithdrawEvent = {
  type: LockType.WITHDRAW;
  amount: string;
  executedAt: string;
  unlockIndex: string;
};
