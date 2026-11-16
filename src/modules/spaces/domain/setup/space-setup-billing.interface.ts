// SPDX-License-Identifier: FSL-1.1-MIT
import type { CheckoutSessionResult } from '#/datasources/billing-api/entities/checkout-session.entity';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';

export const ISpaceSetupBilling = Symbol('ISpaceSetupBilling');

/**
 * What a Workspace setup needs from billing. Always provided: by
 * `BillingService` while `FF_BILLING_SERVICE` is on, by
 * `UnavailableSpaceSetupBilling` while it is off.
 */
export interface ISpaceSetupBilling {
  /** Whether this deployment runs with the billing service. */
  isAvailable(): boolean;

  /** Whether billing is enforced, so a new Workspace starts with a plan. */
  isEnforced(): boolean;

  /** The trial plans a Workspace created now is offered. */
  listTrialPlans(): Promise<Array<PaymentLink>>;

  /** The payment links an existing Workspace is offered; the caller authorizes. */
  listOfferedPaymentLinks(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
  }): Promise<Array<PaymentLink>>;

  /** `returnUrl` must already be validated against the redirect allowlist. */
  createCheckoutSession(args: {
    paymentLinkId: string;
    spaceUuid: Space['uuid'];
    returnUrl: string;
  }): Promise<CheckoutSessionResult>;

  /**
   * Reads the Workspace's subscription from the billing service and stores
   * it when it is trialing or active. Applies nothing.
   *
   * @returns whether the subscription is trialing or active.
   */
  syncSubscription(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
  }): Promise<boolean>;
}
