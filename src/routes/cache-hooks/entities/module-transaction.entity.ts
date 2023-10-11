import {
  EventPayload,
  EventType,
} from '@/routes/cache-hooks/entities/event-payload.entity';

export interface ModuleTransaction
  extends EventPayload<EventType.MODULE_TRANSACTION> {
  module: string;
  txHash: string;
}
