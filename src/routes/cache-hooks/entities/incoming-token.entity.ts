import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface IncomingToken extends EventPayload<EventType.INCOMING_TOKEN> {
  tokenAddress: string;
  txHash: string;
}
