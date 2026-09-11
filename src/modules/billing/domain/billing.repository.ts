// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  CheckoutSession,
  CheckoutSessionResult,
} from '@/datasources/billing-api/entities/checkout-session.entity';
import {
  CheckoutSessionResultSchema,
  CheckoutSessionSchema,
} from '@/datasources/billing-api/entities/checkout-session.entity';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import { PaymentLinksResultSchema } from '@/datasources/billing-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/billing-api/entities/plan.entity';
import { PlanSchema } from '@/datasources/billing-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionsResultSchema } from '@/datasources/billing-api/entities/subscription.entity';
import type {
  SubscriptionUpdatePreview,
  UpdateSubscriptionResult,
} from '@/datasources/billing-api/entities/subscription-update.entity';
import {
  SubscriptionUpdatePreviewSchema,
  UpdateSubscriptionResultSchema,
} from '@/datasources/billing-api/entities/subscription-update.entity';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { IBillingRepository } from '@/modules/billing/domain/billing.repository.interface';

@Injectable()
export class BillingRepository implements IBillingRepository {
  public constructor(
    @Inject(IBillingApi)
    private readonly billingApi: IBillingApi,
  ) {}

  public async getPlan(args: { planId: string }): Promise<Plan> {
    return PlanSchema.parse(await this.billingApi.getPlan(args));
  }

  public async getCustomerSessionUrl(args: {
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<string> {
    return z.string().parse(await this.billingApi.getCustomerSessionUrl(args));
  }

  public async getSubscriptionsByCustomerId(args: {
    upstreamCustomerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>> {
    // Unwrapping the envelope is part of the parse: the datasource hands over
    // the wire shape and this is where it becomes the collection.
    const { subscriptions } = SubscriptionsResultSchema.parse(
      await this.billingApi.getSubscriptionsByCustomerId(args),
    );

    return subscriptions;
  }

  public async listPaymentLinks(
    args: { upstreamCustomerId?: string } = {},
  ): Promise<Array<PaymentLink>> {
    const { paymentLinks } = PaymentLinksResultSchema.parse(
      await this.billingApi.listPaymentLinks(args),
    );

    return paymentLinks;
  }

  public async createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<CheckoutSessionResult> {
    return CheckoutSessionResultSchema.parse(
      await this.billingApi.createCheckoutSession(args),
    );
  }

  public async getCheckoutSession(args: {
    sessionId: string;
  }): Promise<CheckoutSession> {
    return CheckoutSessionSchema.parse(
      await this.billingApi.getCheckoutSession(args),
    );
  }

  public async previewSubscriptionUpdate(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
  }): Promise<SubscriptionUpdatePreview> {
    return SubscriptionUpdatePreviewSchema.parse(
      await this.billingApi.previewSubscriptionUpdate(args),
    );
  }

  public async updateSubscription(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
    paymentLinkId: string;
  }): Promise<UpdateSubscriptionResult> {
    return UpdateSubscriptionResultSchema.parse(
      await this.billingApi.updateSubscription(args),
    );
  }

  public async clearSubscriptions(args: {
    upstreamCustomerId: string;
  }): Promise<void> {
    await this.billingApi.clearSubscriptions(args);
  }
}
