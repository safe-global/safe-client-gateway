// SPDX-License-Identifier: FSL-1.1-MIT
import type { Event } from '#/modules/hooks/routes/entities/event.entity';

export const IHooksRepository = Symbol('IHooksRepository');

export interface IHooksRepository {
  /**
   * @param publishedAt - when the event was published; defaults to now
   */
  onEvent(event: Event, publishedAt?: Date): Promise<unknown>;
}
