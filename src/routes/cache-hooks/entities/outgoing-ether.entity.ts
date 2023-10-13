import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface OutgoingEther extends EventPayload<EventType.OUTGOING_ETHER> {
  txHash: string;
  value: string;
}
