// SPDX-License-Identifier: FSL-1.1-MIT
import type { Customer } from '@/datasources/safe-billing-service-api/entities/customer.entity';
import type { Plan } from '@/datasources/safe-billing-service-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatus,
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
    status?: SubscriptionStatus | 'all';
  }): Promise<Array<Subscription>>;
}
