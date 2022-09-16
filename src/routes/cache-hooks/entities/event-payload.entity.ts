export enum EventType {
  NEW_CONFIRMATION = 'NEW_CONFIRMATION',
  EXECUTED_MULTISIG_TRANSACTION = 'EXECUTED_MULTISIG_TRANSACTION',
  PENDING_MULTISIG_TRANSACTION = 'PENDING_MULTISIG_TRANSACTION',
}

export type EventPayload<T extends EventType> = {
  address: string;
  chainId: string;
  type: T;
};
