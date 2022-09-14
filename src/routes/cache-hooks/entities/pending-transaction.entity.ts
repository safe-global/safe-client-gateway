import { EventPayload, EventType } from './event-payload.entity';

export interface PendingTransaction
  extends EventPayload<EventType.PENDING_MULTISIG_TRANSACTION> {
  safeTxHash: string;
}
