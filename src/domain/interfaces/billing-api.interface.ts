// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  CheckoutSession,
  CheckoutSessionResult,
} from '@/datasources/billing-api/entities/checkout-session.entity';
import type { Customer } from '@/datasources/billing-api/entities/customer.entity';
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
import type { Raw } from '@/validation/entities/raw.entity';

export const IBillingApi = Symbol('IBillingApi');

/**
 * Transport only: every method hands back `Raw<T>`, and `IBillingRepository`
 * is the single place those become domain entities.
 */
export interface IBillingApi {
  listPlans(): Promise<Raw<Array<Plan>>>;

  getPlan(args: { planId: string }): Promise<Raw<Plan>>;

  getCustomer(args: { upstreamCustomerId: string }): Promise<Raw<Customer>>;

  /** Not cached: returns a fresh, single-use Stripe Billing Portal URL. */
  getCustomerSessionUrl(args: {
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<Raw<string>>;

  getSubscriptionsByCustomerId(args: {
    upstreamCustomerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Raw<Array<Subscription>>>;

  /**
   * When `args.upstreamCustomerId` is provided, only payment links associated
   * with that upstream customer are returned; when omitted, only the general
   * (customer-group-level) payment links are returned.
   */
  listPaymentLinks(args?: {
    upstreamCustomerId?: string;
  }): Promise<Raw<Array<PaymentLink>>>;

  /** Not cached: this creates a new resource on every call. */
  createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<Raw<CheckoutSessionResult>>;

  /** Not cached: always fetches a fresh session (e.g. for post-payment polling). */
  getCheckoutSession(args: {
    sessionId: string;
  }): Promise<Raw<CheckoutSession>>;

  /** Not cached: a live proration quote, valid only for the moment it is asked. */
  previewSubscriptionUpdate(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
  }): Promise<Raw<SubscriptionUpdatePreview>>;

  /**
   * Moves a subscription onto another plan, and invalidates the customer's
   * cached subscriptions. `paymentLinkId` is required because the upstream
   * copies its metadata onto the subscription, and the entitlements are
   * derived from that metadata.
   */
  updateSubscription(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
    paymentLinkId: string;
  }): Promise<Raw<UpdateSubscriptionResult>>;

  /** For a change this datasource did not make — a webhook, say. */
  clearSubscriptions(args: { upstreamCustomerId: string }): Promise<void>;
}
