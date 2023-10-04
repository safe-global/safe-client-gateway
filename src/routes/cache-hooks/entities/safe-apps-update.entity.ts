import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface SafeAppsUpdate
  extends Omit<EventPayload<EventType.SAFE_APPS_UPDATE>, 'address'> {}
