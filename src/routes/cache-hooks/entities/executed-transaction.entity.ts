import { EventPayload, EventType } from './event-payload.entity';

export interface ExecutedTransaction
  extends EventPayload<EventType.EXECUTED_MULTISIG_TRANSACTION> {
  safeTxHash: string;
  txHash: string;
}
