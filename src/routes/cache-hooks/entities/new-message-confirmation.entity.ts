import { EventPayload, EventType } from './event-payload.entity';

export interface NewMessageConfirmation
  extends EventPayload<EventType.MESSAGE_CONFIRMATION> {
  messageHash: string;
}
