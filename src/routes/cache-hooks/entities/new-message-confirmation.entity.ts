import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface NewMessageConfirmation
  extends EventPayload<EventType.MESSAGE_CONFIRMATION> {
  messageHash: string;
}
