import { EventPayload, EventType } from './event-payload.entity';

export interface ModuleTransaction
  extends EventPayload<EventType.MODULE_TRANSACTION> {
  module: string;
  txHash: string;
}
