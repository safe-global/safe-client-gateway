// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';

/**
 * Statuses whose plan the upstream will move. Not
 * `ACTIVE_SUBSCRIPTION_STATUSES`, which is frozen in lockstep with the
 * `UQ_subscriptions_active_space` index — same two values, different reason.
 */
export const UPDATABLE_SUBSCRIPTION_STATUSES: ReadonlyArray<SubscriptionStatus> =
  ['active', 'trialing'];

/** A plan change that failed after the Safes it needed gone were removed. */
export const SAFES_REMOVED_PLAN_UNCHANGED_MESSAGE =
  'Your Safes were removed, but the plan change failed. Please try again.';
