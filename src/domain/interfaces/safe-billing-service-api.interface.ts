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
  /**
   * Lists all available billing plans.
   *
   * @returns List of plans
   * @throws {DataSourceError} If the billing service request fails
   */
  listPlans(): Promise<Array<Plan>>;

  /**
   * Gets a billing plan by its ID.
   *
   * @param args.planId - Billing plan ID
   * @returns The plan
   * @throws {DataSourceError} If the billing service request fails
   */
  getPlan(args: { planId: string }): Promise<Plan>;

  /**
   * Gets a billing customer by its upstream customer ID.
   *
   * @param args.customerId - Upstream customer ID
   * @returns The customer
   * @throws {DataSourceError} If the billing service request fails
   */
  getCustomer(args: { customerId: string }): Promise<Customer>;

  /**
   * Gets the subscriptions for a billing customer.
   *
   * @param args.customerId - Upstream customer ID
   * @param args.status - Optional subscription status filter
   * @returns List of subscriptions
   * @throws {DataSourceError} If the billing service request fails
   */
  getSubscriptionsByCustomerId(args: {
    customerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>>;

  /**
   * Lists Stripe Payment Links for the billing service's configured customer group.
   *
   * When `args.customerId` is provided, only payment links associated with
   * that upstream customer are returned; when omitted, only the general
   * (customer-group-level) payment links are returned.
   *
   * @param args.customerId - Optional upstream customer ID to filter payment links by
   * @returns List of payment links
   * @throws {DataSourceError} If the billing service request fails
   */
  listPaymentLinks(args?: { customerId?: string }): Promise<Array<PaymentLink>>;

  /**
   * Creates a Stripe Checkout Session from a payment link.
   *
   * Not cached: this creates a new resource on every call.
   *
   * @param args.paymentLinkId - Payment link ID to create the checkout session from
   * @param args.upstreamCustomerId - Upstream customer ID for the checkout session
   * @param args.returnUrl - URL to redirect to on completion
   * @returns The created checkout session
   * @throws {DataSourceError} If the billing service request fails
   */
  createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<CheckoutSession>;

  /**
   * Gets a Stripe Checkout Session by its ID.
   *
   * Not cached: always fetches a fresh session (e.g. for post-payment polling).
   *
   * @param args.sessionId - Checkout session ID
   * @returns The checkout session
   * @throws {DataSourceError} If the billing service request fails
   */
  getCheckoutSession(args: { sessionId: string }): Promise<CheckoutSession>;
}
