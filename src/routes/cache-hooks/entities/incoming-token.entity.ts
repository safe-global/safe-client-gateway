import { EventPayload, EventType } from './event-payload.entity';

export interface IncomingToken extends EventPayload<EventType.INCOMING_TOKEN> {
  tokenAddress: string;
  txHash: string;
}
