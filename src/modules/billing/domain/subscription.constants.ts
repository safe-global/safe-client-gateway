// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';

/**
 * Statuses whose plan the upstream will move. Not
 * `ACTIVE_SUBSCRIPTION_STATUSES`, which is frozen in lockstep with the
 * `UQ_subscriptions_active_space` index — same two values, different reason.
 */
export const UPDATABLE_SUBSCRIPTION_STATUSES: ReadonlyArray<SubscriptionStatus> =
  ['active', 'trialing'];
