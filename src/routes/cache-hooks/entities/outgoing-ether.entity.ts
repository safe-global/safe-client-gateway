import { EventPayload, EventType } from './event-payload.entity';

export interface OutgoingEther extends EventPayload<EventType.OUTGOING_ETHER> {
  txHash: string;
  value: string;
}
