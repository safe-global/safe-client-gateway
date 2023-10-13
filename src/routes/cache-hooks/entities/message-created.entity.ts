import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface MessageCreated
  extends EventPayload<EventType.MESSAGE_CREATED> {
  messageHash: string;
}
