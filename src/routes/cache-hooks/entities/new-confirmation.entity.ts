import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface NewConfirmation
  extends EventPayload<EventType.NEW_CONFIRMATION> {
  owner: string;
  safeTxHash: string;
}
