import type { Event } from '@/modules/hooks/routes/entities/event.entity';

export const IHooksRepository = Symbol('IHooksRepository');

export interface IHooksRepository {
  onEvent(event: Event): Promise<unknown>;
}
