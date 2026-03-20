// SPDX-License-Identifier: FSL-1.1-MIT
import type { Event } from '@/modules/hooks/routes/entities/event.entity';

export const IPushNotificationService = Symbol('IPushNotificationService');

export interface IPushNotificationService {
  /**
   * Enqueues an event for push notification processing.
   * Errors are logged internally — callers are guaranteed this will not throw.
   *
   * @param event - The webhook {@link Event} to process
   */
  enqueueEvent(event: Event): Promise<void>;
}
