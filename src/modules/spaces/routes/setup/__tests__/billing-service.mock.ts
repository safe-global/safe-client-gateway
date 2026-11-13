// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import { checkoutSessionResultBuilder } from '#/datasources/billing-api/entities/__tests__/checkout-session.builder';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import type { Subscription } from '#/datasources/billing-api/entities/subscription.entity';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { rawify } from '#/validation/entities/raw.entity';

/** What the mocked billing service answers; a spec mutates it per test. */
export type BillingServiceState = {
  /** The general payment links; no Workspace has negotiated ones. */
  catalog: Array<PaymentLink>;
  /** Keyed by the upstream customer id: the space UUID without dashes. */
  subscriptionsByCustomer: Map<string, Array<Subscription>>;
  isCheckoutDown: boolean;
};

export function emptyBillingServiceState(): BillingServiceState {
  return {
    catalog: [],
    subscriptionsByCustomer: new Map(),
    isCheckoutDown: false,
  };
}

const SUBSCRIPTIONS_PATH = /\/api\/v1\/customers\/([0-9a-f]+)\/subscriptions$/;

/**
 * Answers the billing service's HTTP calls from `state`, read on every call:
 * the payment links, a customer's subscriptions, and a checkout for any link
 * in the catalog.
 */
export function mockBillingService(args: {
  networkService: MockedObject<INetworkService>;
  billingBaseUri: string;
  state: BillingServiceState;
}): void {
  const { networkService, billingBaseUri, state } = args;
  networkService.get.mockImplementation(({ url, networkRequest }) => {
    if (url === `${billingBaseUri}/api/v1/payment-links`) {
      const isSpaceSpecific =
        (networkRequest?.params as { customerId?: string } | undefined)
          ?.customerId !== undefined;
      return Promise.resolve({
        data: rawify({ paymentLinks: isSpaceSpecific ? [] : state.catalog }),
        status: 200,
      });
    }
    const customer = SUBSCRIPTIONS_PATH.exec(url)?.[1];
    if (customer) {
      const subscriptions = state.subscriptionsByCustomer.get(customer);
      // As upstream: a customer exists only once one of its checkouts completed.
      if (!subscriptions) {
        return Promise.reject(
          new NetworkResponseError(new URL(url), { status: 404 } as Response, {
            message: 'Customer not found.',
          }),
        );
      }
      return Promise.resolve({ data: rawify({ subscriptions }), status: 200 });
    }
    return Promise.reject(new Error(`Could not match ${url}`));
  });
  networkService.post.mockImplementation(({ url }) => {
    const isCatalogCheckout = state.catalog.some(
      (link) =>
        url === `${billingBaseUri}/api/v1/payment-links/${link.id}/checkout`,
    );
    if (isCatalogCheckout && !state.isCheckoutDown) {
      return Promise.resolve({
        data: rawify(checkoutSessionResultBuilder().build()),
        status: 200,
      });
    }
    return Promise.reject(new Error(`Could not match ${url}`));
  });
}
