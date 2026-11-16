// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { CheckoutSessionResult } from '#/datasources/billing-api/entities/checkout-session.entity';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import { BillingUnavailableError } from '#/modules/spaces/domain/setup/errors/billing-unavailable.error';
import type { ISpaceSetupBilling } from '#/modules/spaces/domain/setup/space-setup-billing.interface';

/**
 * Billing for a deployment without the billing service: never enforced,
 * nothing to sell, no subscription to sync. A setup without a plan applies
 * at once; one with a plan is refused before anything is written.
 */
@Injectable()
export class UnavailableSpaceSetupBilling implements ISpaceSetupBilling {
  public isAvailable(): boolean {
    return false;
  }

  public isEnforced(): boolean {
    return false;
  }

  public listTrialPlans(): Promise<Array<PaymentLink>> {
    return Promise.reject(new BillingUnavailableError());
  }

  public listOfferedPaymentLinks(): Promise<Array<PaymentLink>> {
    return Promise.reject(new BillingUnavailableError());
  }

  public createCheckoutSession(): Promise<CheckoutSessionResult> {
    return Promise.reject(new BillingUnavailableError());
  }

  public syncSubscription(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
