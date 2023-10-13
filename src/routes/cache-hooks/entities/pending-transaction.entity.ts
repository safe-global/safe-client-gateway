import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface PendingTransaction
  extends EventPayload<EventType.PENDING_MULTISIG_TRANSACTION> {
  safeTxHash: string;
}
