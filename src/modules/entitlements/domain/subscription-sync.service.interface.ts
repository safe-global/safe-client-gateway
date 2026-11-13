// SPDX-License-Identifier: FSL-1.1-MIT
import type { WebhookEvent } from '#/modules/billing/domain/entities/webhook-event.entity';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';

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

  /**
   * Materializes the space's subscription state as the billing service holds
   * it now, with no event behind it: a read path that cannot wait for a
   * webhook that may be late or lost. Applies nothing.
   */
  syncSpace(args: {
    spaceId: Space['id'];
    upstreamCustomerId: string;
  }): Promise<void>;
}
