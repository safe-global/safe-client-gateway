import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface OutgoingToken extends EventPayload<EventType.OUTGOING_TOKEN> {
  tokenAddress: string;
  txHash: string;
}
