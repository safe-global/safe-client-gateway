// SPDX-License-Identifier: FSL-1.1-MIT
import type { SubscriptionStatus as BillingSubscriptionStatus } from '@/datasources/billing-api/entities/subscription.entity';
import type { SubscriptionStatus } from '@/modules/subscriptions/domain/entities/subscription.entity';

// billing-service's status set is wider than CGW's persisted one; trialing
// folds into active, unpaid/incomplete* fold into canceled, pending product
// confirmation of the intended mapping.
const BILLING_STATUS_MAP: Record<
  BillingSubscriptionStatus,
  SubscriptionStatus
> = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  paused: 'paused',
  canceled: 'canceled',
  incomplete: 'canceled',
  incomplete_expired: 'canceled',
};

export function mapBillingSubscriptionStatus(
  status: BillingSubscriptionStatus,
): SubscriptionStatus {
  return BILLING_STATUS_MAP[status];
}
