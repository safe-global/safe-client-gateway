import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface IncomingEther extends EventPayload<EventType.INCOMING_ETHER> {
  txHash: string;
  value: string;
}
