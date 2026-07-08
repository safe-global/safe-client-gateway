// SPDX-License-Identifier: FSL-1.1-MIT
import type { CheckoutSession } from '@/datasources/safe-billing-service-api/entities/checkout-session.entity';
import type { Customer } from '@/datasources/safe-billing-service-api/entities/customer.entity';
import type { PaymentLink } from '@/datasources/safe-billing-service-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/safe-billing-service-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/safe-billing-service-api/entities/subscription.entity';

export const ISafeBillingServiceApi = Symbol('ISafeBillingServiceApi');

export interface ISafeBillingServiceApi {
  listPlans(): Promise<Array<Plan>>;

  getPlan(args: { planId: string }): Promise<Plan>;

  getCustomer(args: { upstreamCustomerId: string }): Promise<Customer>;

  getSubscriptionsByCustomerId(args: {
    upstreamCustomerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>>;

  /**
   * When `args.customerId` is provided, only payment links associated with
   * that upstream customer are returned; when omitted, only the general
   * (customer-group-level) payment links are returned.
   */
  listPaymentLinks(args?: { customerId?: string }): Promise<Array<PaymentLink>>;

  /** Not cached: this creates a new resource on every call. */
  createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<CheckoutSession>;

  /** Not cached: always fetches a fresh session (e.g. for post-payment polling). */
  getCheckoutSession(args: { sessionId: string }): Promise<CheckoutSession>;
}
