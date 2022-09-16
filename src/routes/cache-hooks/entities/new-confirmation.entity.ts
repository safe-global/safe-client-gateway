import { EventPayload, EventType } from './event-payload.entity';

export interface NewConfirmation
  extends EventPayload<EventType.NEW_CONFIRMATION> {
  owner: string;
  safeTxHash: string;
}
