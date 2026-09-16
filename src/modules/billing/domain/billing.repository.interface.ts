// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  CheckoutSession,
  CheckoutSessionResult,
} from '@/datasources/billing-api/entities/checkout-session.entity';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/billing-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/billing-api/entities/subscription.entity';
import type {
  SubscriptionUpdatePreview,
  UpdateSubscriptionResult,
} from '@/datasources/billing-api/entities/subscription-update.entity';

export const IBillingRepository = Symbol('IBillingRepository');

/**
 * The parse boundary in front of `IBillingApi`: the datasource hands back
 * `Raw<T>`, and every method here is where it becomes a domain entity. The
 * datasource is not consumed anywhere else.
 */
export interface IBillingRepository {
  getPlan(args: { planId: string }): Promise<Plan>;

  getCustomerSessionUrl(args: {
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<string>;

  getSubscriptionsByCustomerId(args: {
    upstreamCustomerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>>;

  listPaymentLinks(args?: {
    upstreamCustomerId?: string;
  }): Promise<Array<PaymentLink>>;

  createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<CheckoutSessionResult>;

  getCheckoutSession(args: { sessionId: string }): Promise<CheckoutSession>;

  previewSubscriptionUpdate(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
  }): Promise<SubscriptionUpdatePreview>;

  updateSubscription(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
    paymentLinkId: string;
  }): Promise<UpdateSubscriptionResult>;

  /** Nothing to parse: passed through so callers need only this seam. */
  clearSubscriptions(args: { upstreamCustomerId: string }): Promise<void>;
}
