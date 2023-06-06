import { EventPayload, EventType } from './event-payload.entity';

export interface IncomingEther extends EventPayload<EventType.INCOMING_ETHER> {
  txHash: string;
  value: string;
}
