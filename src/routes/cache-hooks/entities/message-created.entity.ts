import { EventPayload, EventType } from './event-payload.entity';

export interface MessageCreated
  extends EventPayload<EventType.MESSAGE_CREATED> {
  messageHash: string;
}
