export const CALL_OPERATION = 0;
export const DELEGATE_OPERATION = 1;

export type Call = typeof CALL_OPERATION;
export type Delegate = typeof DELEGATE_OPERATION;
export type Operation = Call | Delegate;
