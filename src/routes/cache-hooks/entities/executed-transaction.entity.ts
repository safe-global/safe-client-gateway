import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface ExecutedTransaction
  extends EventPayload<EventType.EXECUTED_MULTISIG_TRANSACTION> {
  safeTxHash: string;
  txHash: string;
}
