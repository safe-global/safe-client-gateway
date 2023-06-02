import { EventPayload, EventType } from './event-payload.entity';

export interface OutgoingToken extends EventPayload<EventType.OUTGOING_TOKEN> {
  tokenAddress: string;
  txHash: string;
}
