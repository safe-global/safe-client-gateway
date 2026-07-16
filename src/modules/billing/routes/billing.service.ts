// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/billing-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/billing-api/entities/subscription.entity';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import {
  getRedirectConfig,
  type RedirectConfig,
  resolveAndValidateRedirectUrl,
} from '@/modules/auth/utils/auth-redirect.helper';
import type { CheckoutSession } from '@/modules/billing/routes/entities/checkout-session.entity';
import { toCheckoutSessionDto } from '@/modules/billing/routes/entities/checkout-session.entity';
import type { CheckoutSessionResult } from '@/modules/billing/routes/entities/checkout-session-result.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class BillingService {
  private readonly redirectConfig: RedirectConfig;

  public constructor(
    @Inject(IBillingApi)
    private readonly billingApi: IBillingApi,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.redirectConfig = getRedirectConfig(this.configurationService);
  }

  public async getSubscriptions(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    authPayload: AuthPayload;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);

    return await this.billingApi.getSubscriptionsByCustomerId({
      upstreamCustomerId: args.spaceUuid,
      status: args.status,
    });
  }

  public async getPlan(planId: string): Promise<Plan> {
    return await this.billingApi.getPlan({ planId });
  }

  public async getSessionUrl(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    authPayload: AuthPayload;
    returnUrl: string;
  }): Promise<{ url: string }> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);

    const url = await this.billingApi.getCustomerSessionUrl({
      upstreamCustomerId: args.spaceUuid,
      returnUrl: this.validateReturnUrl(args.returnUrl),
    });

    return { url };
  }

  public async getSpacePaymentLinks(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    authPayload: AuthPayload;
  }): Promise<Array<PaymentLink>> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);

    const [spaceLinks, generalLinks] = await Promise.all([
      this.billingApi.listPaymentLinks({
        upstreamCustomerId: args.spaceUuid,
      }),
      this.billingApi.listPaymentLinks(),
    ]);

    const byId = new Map(
      [...generalLinks, ...spaceLinks].map((link) => [link.id, link]),
    );
    return Array.from(byId.values());
  }

  public async createCheckoutUrl(args: {
    paymentLinkId: string;
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    authPayload: AuthPayload;
    returnUrl: string;
  }): Promise<CheckoutSessionResult> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);

    return await this.billingApi.createCheckoutSession({
      paymentLinkId: args.paymentLinkId,
      upstreamCustomerId: args.spaceUuid,
      returnUrl: this.validateReturnUrl(args.returnUrl),
    });
  }

  public async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
    const session = await this.billingApi.getCheckoutSession({ sessionId });

    return toCheckoutSessionDto(session);
  }

  private validateReturnUrl(returnUrl: string): string {
    return resolveAndValidateRedirectUrl(this.redirectConfig, returnUrl);
  }

  private async assertSpaceMember(
    spaceId: Space['id'],
    authPayload: AuthPayload,
  ): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);
  }
}
