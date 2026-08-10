// SPDX-License-Identifier: FSL-1.1-MIT
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';

export const ISubscriptionSyncService = Symbol('ISubscriptionSyncService');

/**
 * Materializes upstream subscription state on billing webhooks. The
 * implementation lives in `routes/` (it needs `EntitlementsService` and
 * `ISpacesRepository`, which would cycle back through this module's
 * `domain/` if declared there) — this interface is what other modules
 * (`billing`) are allowed to depend on instead of reaching into `routes/`.
 */
export interface ISubscriptionSyncService {
  handleWebhook(event: WebhookEvent): Promise<void>;
}
