import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface ChainUpdate
  extends Omit<EventPayload<EventType.CHAIN_UPDATE>, 'address'> {}
