// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
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
  offersPlan,
} from '@/modules/billing/domain/payment-link-offer.rules';
import { UPDATABLE_SUBSCRIPTION_STATUSES } from '@/modules/billing/domain/subscription.constants';
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
   * What moving this subscription onto `planId` would cost right now.
   *
   * Rejects for the same reasons as the PATCH, bar one: it does not require an
   * updatable subscription. The upstream quotes a canceled one just the same,
   * and refusing would hide the number a client needs to explain why the
   * change is unavailable.
   */
  public async previewSubscriptionUpdate(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    subscriptionId: string;
    planId: string;
    authPayload: AuthPayload;
  }): Promise<SubscriptionUpdatePreview> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);
    // No link is resolved: the upstream preview takes only the price, so a tie
    // between several links offering it cannot matter here.
    const [offeredLinks, subscription] = await Promise.all([
      this.listOfferedPaymentLinks(args),
      this.findOwnedSubscription(args),
    ]);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    // Before the offer check, as in the PATCH: the offer filter drops the link
    // for the plan in force, so it would answer "not available" instead.
    if (subscription.plan.id === args.planId) {
      throw new ConflictException('The workspace is already on this plan');
    }
    if (!offeredLinks.some((link) => offersPlan(link, args.planId))) {
      throw new ForbiddenException(
        'This plan is not available for this workspace',
      );
    }

    return await this.billingApi.previewSubscriptionUpdate({
      upstreamCustomerId: args.spaceUuid,
      subscriptionId: args.subscriptionId,
      planId: args.planId,
    });
  }

  /**
   * Moves the workspace onto another plan.
   *
   * Membership, not admin, matching `createCheckoutUrl`: starting a paid
   * subscription is open to any member. A fresh second factor is required on
   * top, pinned in the gated table of `elevation.integration.spec.ts`.
   *
   * Returning does not mean the entitlements have moved: those are
   * materialized when the upstream's webhook arrives, so
   * `GET /v1/spaces/:spaceId/entitlements` answers with the previous plan
   * until then. Same as after a checkout.
   */
  public async updateSubscription(args: {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    subscriptionId: string;
    planId: string;
    paymentLinkId?: string;
    authPayload: AuthPayload;
  }): Promise<UpdateSubscriptionResult> {
    await this.assertSpaceMember(args.spaceId, args.authPayload);

    const [offeredLinks, subscription] = await Promise.all([
      this.listOfferedPaymentLinks(args),
      this.findOwnedSubscription(args),
    ]);

    // The subscription's own state is settled before the offer is: the link
    // for the plan in force is filtered out of the offered set, so resolving
    // it first would answer 403 for a plan the workspace already has.
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Upstream rejects this too, but as a 400 after a round trip.
    if (!UPDATABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      throw new ConflictException(
        'This subscription is not in an updatable state',
      );
    }

    if (subscription.plan.id === args.planId) {
      throw new ConflictException('The workspace is already on this plan');
    }

    const paymentLink = this.paymentLinkForPlanOrFail(offeredLinks, args);

    const result = await this.billingApi.updateSubscription({
      upstreamCustomerId: args.spaceUuid,
      subscriptionId: args.subscriptionId,
      planId: args.planId,
      paymentLinkId: paymentLink.id,
    });

    // Relaying a 200 would say the workspace moved plan when it did not, and
    // the client would re-read the old plan with nothing explaining why.
    if (!result.success) {
      this.loggingService.error(
        `Billing service reported an unsuccessful plan change for subscription ${args.subscriptionId} of workspace ${args.spaceUuid}`,
      );
      throw new BadGatewayException('Plan change failed upstream');
    }

    return result;
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

    const unclassified = generalLinks.filter(isUnclassifiedTrialLink);
    if (unclassified.length > 0) {
      this.loggingService.error(
        `Trial payment link(s) offered to nobody, missing a recognized ${GRACE_PERIOD_METADATA_KEY} tag: ${unclassified
          .map((link) => link.id)
          .join(', ')}`,
      );
    }

    const offeredGeneralLinks = generalLinks.filter((link) =>
      isOfferedToSpace(link, eligibility),
    );

    return [
      ...new Map(
        [...offeredGeneralLinks, ...spaceLinks].map((link) => [link.id, link]),
      ).values(),
    ];
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

  /**
   * The subscription named by the path, if it is this workspace's — the param
   * alone names one in the upstream's namespace, not necessarily this
   * customer's.
   *
   * Cache-first, so status and plan can lag by the billing TTL. Tolerable: the
   * upstream re-checks both, and the checks built on this exist to answer
   * without a round trip and say which one failed.
   */
  private async findOwnedSubscription(args: {
    spaceUuid: Space['uuid'];
    subscriptionId: string;
  }): Promise<Subscription | undefined> {
    const subscriptions = await this.billingApi.getSubscriptionsByCustomerId({
      upstreamCustomerId: args.spaceUuid,
    });

    return subscriptions.find(
      (candidate) => candidate.id === args.subscriptionId,
    );
  }

  /**
   * Which offered link the upstream must copy the new plan's metadata from.
   *
   * A caller-supplied `paymentLinkId` is checked, not trusted: the upstream
   * does not verify that the link it reads offers the plan it bills, so an
   * unchecked pair would buy one plan and be entitled to another.
   */
  private paymentLinkForPlanOrFail(
    offeredLinks: Array<PaymentLink>,
    args: { planId: string; paymentLinkId?: string },
  ): PaymentLink {
    if (args.paymentLinkId !== undefined) {
      const named = offeredLinks.find((link) => link.id === args.paymentLinkId);
      // Honoured or refused, never swapped for another offering the same plan.
      if (!named) {
        throw new ForbiddenException(
          'This payment link is not available for this workspace',
        );
      }
      if (!offersPlan(named, args.planId)) {
        throw new UnprocessableEntityException(
          'The payment link does not offer this plan',
        );
      }
      return named;
    }

    const linksOfferingPlan = offeredLinks.filter((link) =>
      offersPlan(link, args.planId),
    );
    if (linksOfferingPlan.length === 0) {
      throw new ForbiddenException(
        'This plan is not available for this workspace',
      );
    }
    if (linksOfferingPlan.length > 1) {
      // A negotiated link beside the general one, say: same price, different
      // metadata and so different entitlements. Only the caller can pick.
      this.loggingService.error(
        `Payment link(s) sharing price ${args.planId}, cannot pick one: ${linksOfferingPlan
          .map((link) => link.id)
          .join(', ')}`,
      );
      throw new ConflictException(
        'Several plans match; specify which paymentLinkId to use',
      );
    }

    return linksOfferingPlan[0];
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
