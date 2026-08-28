// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/billing-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/billing-api/entities/subscription.entity';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import {
  getRedirectConfig,
  type RedirectConfig,
  resolveAndValidateRedirectUrl,
} from '@/modules/auth/utils/auth-redirect.helper';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import type { SpaceOfferEligibility } from '@/modules/billing/domain/payment-link-offer.rules';
import {
  isOfferedToSpace,
  isUnclassifiedTrialLink,
} from '@/modules/billing/domain/payment-link-offer.rules';
import type { CheckoutSession } from '@/modules/billing/routes/entities/checkout-session.entity';
import { toCheckoutSessionDto } from '@/modules/billing/routes/entities/checkout-session.entity';
import type { CheckoutSessionResult } from '@/modules/billing/routes/entities/checkout-session-result.entity';
import { GRACE_PERIOD_METADATA_KEY } from '@/modules/entitlements/domain/entitlements.constants';
import { predatesEnforcement } from '@/modules/entitlements/domain/entitlements.rules';
import { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class BillingService {
  private readonly redirectConfig: RedirectConfig;
  private readonly enforcementStartsAt: Date;
  /** Link ids already reported as untagged, so the warning fires once each. */
  private readonly warnedUnclassifiedLinkIds = new Set<PaymentLink['id']>();

  public constructor(
    @Inject(IBillingApi)
    private readonly billingApi: IBillingApi,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISubscriptionSyncService)
    private readonly subscriptionSyncService: ISubscriptionSyncService,
    @Inject(ISubscriptionsRepository)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.redirectConfig = getRedirectConfig(this.configurationService);
    this.enforcementStartsAt = this.configurationService.getOrThrow<Date>(
      'entitlements.enforcementStartsAt',
    );
  }

  public async processWebhook(payload: WebhookEvent): Promise<void> {
    await this.subscriptionSyncService.handleWebhook(payload);
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

    return await this.listOfferedPaymentLinks(args);
  }

  public async createCheckoutUrl(args: {
    paymentLinkId: string;
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    authPayload: AuthPayload;
    returnUrl: string;
  }): Promise<CheckoutSessionResult> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);
    const returnUrl = this.validateReturnUrl(args.returnUrl);

    // A link the workspace is not offered is not checkable out either, or the
    // filtered list would only be a hint.
    const offeredLinks = await this.listOfferedPaymentLinks(args);
    if (!offeredLinks.some((link) => link.id === args.paymentLinkId)) {
      throw new ForbiddenException(
        'This subscription is not available for this workspace',
      );
    }

    return await this.billingApi.createCheckoutSession({
      paymentLinkId: args.paymentLinkId,
      upstreamCustomerId: args.spaceUuid,
      returnUrl,
    });
  }

  public async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
    const session = await this.billingApi.getCheckoutSession({ sessionId });

    return toCheckoutSessionDto(session);
  }

  /**
   * The general catalog narrowed to what this workspace is entitled to, with
   * the space-specific catalog merged in on top, always offered: a link
   * negotiated for one customer is not subject to the general enforcement
   * rule. Space-specific wins on a shared id.
   */
  private async listOfferedPaymentLinks(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
  }): Promise<Array<PaymentLink>> {
    const [spaceLinks, generalLinks, eligibility] = await Promise.all([
      this.billingApi.listPaymentLinks({
        upstreamCustomerId: args.spaceUuid,
      }),
      this.billingApi.listPaymentLinks(),
      this.getOfferEligibility(args.spaceId),
    ]);

    this.warnOnUnclassifiedTrials(generalLinks);

    const offeredGeneralLinks = generalLinks.filter((link) =>
      isOfferedToSpace(link, eligibility),
    );
    const linksById = new Map(
      [...offeredGeneralLinks, ...spaceLinks].map((link) => [link.id, link]),
    );
    return Array.from(linksById.values());
  }

  /**
   * A trial link with no recognized `gracePeriod` tag is offered to nobody, so
   * an untagged catalog looks like an empty one. Surface it rather than serving
   * fewer offers in silence — once per link, since this runs on every payment
   * links and checkout request and a misconfigured catalog would otherwise
   * repeat the same line at request rate.
   */
  private warnOnUnclassifiedTrials(generalLinks: Array<PaymentLink>): void {
    const unclassified = generalLinks
      .filter(isUnclassifiedTrialLink)
      .filter((link) => !this.warnedUnclassifiedLinkIds.has(link.id));
    if (unclassified.length === 0) {
      return;
    }
    for (const link of unclassified) {
      this.warnedUnclassifiedLinkIds.add(link.id);
    }
    this.loggingService.warn(
      `Dropping ${unclassified.length} trial payment link(s) with no recognized ${GRACE_PERIOD_METADATA_KEY} metadata: ${unclassified
        .map((link) => link.id)
        .join(', ')}`,
    );
  }

  private async getOfferEligibility(
    spaceId: Space['id'],
  ): Promise<SpaceOfferEligibility> {
    const [spaceCreatedAt, subscription] = await Promise.all([
      this.spacesRepository.findCreatedAtById(spaceId),
      this.subscriptionsRepository.getSubscriptionSummary(spaceId),
    ]);

    return {
      createdBeforeEnforcement: predatesEnforcement({
        createdAt: spaceCreatedAt,
        startsAt: this.enforcementStartsAt,
      }),
      hasEverSubscribed: subscription.hasEverSubscribed,
      activePlanName: subscription.activePlanName,
    };
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
