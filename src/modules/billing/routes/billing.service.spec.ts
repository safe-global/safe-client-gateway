// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import {
  checkoutSessionBuilder,
  checkoutSessionResultBuilder,
} from '@/datasources/billing-api/entities/__tests__/checkout-session.builder';
import {
  paymentLinkBuilder,
  paymentLinkPricedAt,
  trialPaymentLinkBuilder,
} from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import { planBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import {
  subscriptionUpdatePreviewBuilder,
  updateSubscriptionResultBuilder,
} from '@/datasources/billing-api/entities/__tests__/subscription-update.builder';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import type { Subscription } from '@/datasources/billing-api/entities/subscription.entity';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { webhookEventBuilder } from '@/modules/billing/domain/entities/__tests__/webhook-event.builder';
import { planNameOf } from '@/modules/billing/domain/payment-link-offer.rules';
import { BillingService } from '@/modules/billing/routes/billing.service';
import { toCheckoutSessionDto } from '@/modules/billing/routes/entities/checkout-session.entity';
import { spaceSubscriptionBuilder } from '@/modules/entitlements/domain/entities/__tests__/space-subscription.builder';
import type { ISubscriptionSyncService } from '@/modules/entitlements/domain/subscription-sync.service.interface';
import type { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

const billingApiMock = {
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  getCustomer: vi.fn(),
  getCustomerSessionUrl: vi.fn(),
  getSubscriptionsByCustomerId: vi.fn(),
  listPaymentLinks: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  previewSubscriptionUpdate: vi.fn(),
  updateSubscription: vi.fn(),
  clearSubscriptions: vi.fn(),
} as MockedObject<IBillingApi>;

const membersRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

const subscriptionSyncServiceMock = {
  handleWebhook: vi.fn(),
} as MockedObject<ISubscriptionSyncService>;

const subscriptionsRepositoryMock = {
  getSubscriptionSummary: vi.fn(),
} as MockedObject<ISubscriptionsRepository>;

const spacesRepositoryMock = {
  findCreatedAtById: vi.fn(),
} as MockedObject<ISpacesRepository>;

const loggingServiceMock = {
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
} as MockedObject<ILoggingService>;

// The enforcement date the offer rule splits workspaces on, and one stamp on
// each side of it.
const ENFORCEMENT_STARTS_AT = '2026-10-01T00:00:00Z';
const BEFORE_ENFORCEMENT = '2026-09-30T23:59:59Z';
const AFTER_ENFORCEMENT = '2026-11-01T00:00:00Z';

describe('BillingService', () => {
  let service: BillingService;
  let postLoginRedirectUri: string;

  function withinRedirectOrigin(): string {
    return new URL(faker.system.filePath(), postLoginRedirectUri).toString();
  }

  /**
   * Serves `links` as the general catalog and nothing space-specific, which is
   * the shape the offer filter runs on.
   */
  function mockCatalog(links: Array<PaymentLink>): void {
    billingApiMock.listPaymentLinks.mockImplementation((args) =>
      Promise.resolve(args?.upstreamCustomerId ? [] : links),
    );
  }

  function spaceCreatedAt(createdAt: string): void {
    spacesRepositoryMock.findCreatedAtById.mockResolvedValue(
      new Date(createdAt),
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    postLoginRedirectUri = faker.internet.url();
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'auth.postLoginRedirectUri',
      postLoginRedirectUri,
    );
    fakeConfigurationService.set('application.isProduction', false);
    fakeConfigurationService.set(
      'entitlements.enforcementStartsAt',
      new Date(ENFORCEMENT_STARTS_AT),
    );

    // Defaults for the specs that are not about the offer filter: a workspace
    // created after the enforcement date that has never subscribed.
    spaceCreatedAt(AFTER_ENFORCEMENT);
    subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
      hasEverSubscribed: false,
      activePlanName: null,
    });

    service = new BillingService(
      billingApiMock,
      membersRepositoryMock,
      fakeConfigurationService,
      subscriptionSyncServiceMock,
      subscriptionsRepositoryMock,
      spacesRepositoryMock,
      loggingServiceMock,
    );
  });

  describe('constructor', () => {
    // The date's *format* is guaranteed upstream: `configuration.ts` parses it
    // and `RootConfigurationSchema` rejects a non-ISO env value at boot. What
    // is still worth asserting here is that a missing key is not tolerated.
    it('should throw when entitlements.enforcementStartsAt is not configured', () => {
      const fakeConfigurationService = new FakeConfigurationService();
      fakeConfigurationService.set(
        'auth.postLoginRedirectUri',
        faker.internet.url(),
      );
      fakeConfigurationService.set('application.isProduction', false);

      expect(
        () =>
          new BillingService(
            billingApiMock,
            membersRepositoryMock,
            fakeConfigurationService,
            subscriptionSyncServiceMock,
            subscriptionsRepositoryMock,
            spacesRepositoryMock,
            loggingServiceMock,
          ),
      ).toThrow('No value set for key entitlements.enforcementStartsAt');
    });
  });

  describe('processWebhook', () => {
    it('delegates to SubscriptionSyncService', async () => {
      const payload = webhookEventBuilder().build();

      await service.processWebhook(payload);

      expect(subscriptionSyncServiceMock.handleWebhook).toHaveBeenCalledWith(
        payload,
      );
    });
  });

  describe('getSubscriptions', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should return subscriptions for %s space members',
      async (_label, builder) => {
        const spaceId = faker.number.int();
        const spaceUuid = faker.string.uuid();
        const authPayload = new AuthPayload(builder().build());
        const subscriptions = [subscriptionBuilder().build()];
        membersRepositoryMock.findOne.mockResolvedValue(
          memberBuilder().build(),
        );
        billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue(
          subscriptions,
        );

        const result = await service.getSubscriptions({
          spaceId,
          spaceUuid,
          authPayload,
        });

        expect(result).toBe(subscriptions);
        expect(
          billingApiMock.getSubscriptionsByCustomerId,
        ).toHaveBeenCalledWith({
          upstreamCustomerId: spaceUuid,
          status: undefined,
        });
      },
    );

    it('should throw when not authenticated', async () => {
      await expect(
        service.getSubscriptions({
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload: new AuthPayload(),
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        billingApiMock.getSubscriptionsByCustomerId,
      ).not.toHaveBeenCalled();
    });

    it('should throw when the user is not a space member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.getSubscriptions({
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        billingApiMock.getSubscriptionsByCustomerId,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getPlan', () => {
    it('should return the plan', async () => {
      const plan = planBuilder().build();
      billingApiMock.getPlan.mockResolvedValue(plan);

      const result = await service.getPlan(plan.id);

      expect(result).toBe(plan);
      expect(billingApiMock.getPlan).toHaveBeenCalledWith({ planId: plan.id });
    });
  });

  describe('getSessionUrl', () => {
    it('should return the session url for a space member', async () => {
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const returnUrl = withinRedirectOrigin();
      const sessionUrl = faker.internet.url();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      billingApiMock.getCustomerSessionUrl.mockResolvedValue(sessionUrl);

      const result = await service.getSessionUrl({
        spaceId,
        spaceUuid,
        authPayload,
        returnUrl,
      });

      expect(result).toEqual({ url: sessionUrl });
      expect(billingApiMock.getCustomerSessionUrl).toHaveBeenCalledWith({
        upstreamCustomerId: spaceUuid,
        returnUrl: new URL(returnUrl, postLoginRedirectUri).toString(),
      });
    });

    it('should throw when the user is not a space member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.getSessionUrl({
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
          returnUrl: withinRedirectOrigin(),
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.getCustomerSessionUrl).not.toHaveBeenCalled();
    });

    it('should throw when returnUrl targets a disallowed origin', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());

      await expect(
        service.getSessionUrl({
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
          returnUrl: faker.internet.url(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(billingApiMock.getCustomerSessionUrl).not.toHaveBeenCalled();
    });
  });

  describe('getSpacePaymentLinks', () => {
    it('should merge space-specific and general payment links for a space member', async () => {
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const spaceLink = paymentLinkBuilder().build();
      const generalLink = paymentLinkBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      // A paid link in the general catalog needs the space to have subscribed
      // before to be offered; this test is about merge behaviour, not that.
      subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
        hasEverSubscribed: true,
        activePlanName: null,
      });
      billingApiMock.listPaymentLinks.mockImplementation((args) =>
        Promise.resolve(args?.upstreamCustomerId ? [spaceLink] : [generalLink]),
      );

      const result = await service.getSpacePaymentLinks({
        spaceId,
        spaceUuid,
        authPayload,
      });

      expect(result).toEqual([generalLink, spaceLink]);
      expect(billingApiMock.listPaymentLinks).toHaveBeenCalledWith({
        upstreamCustomerId: spaceUuid,
      });
      expect(billingApiMock.listPaymentLinks).toHaveBeenCalledWith();
    });

    it('should prefer the space-specific link when the same id is present in both lists', async () => {
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const sharedId = faker.string.uuid();
      const spaceLink = paymentLinkBuilder().with('id', sharedId).build();
      const generalLink = paymentLinkBuilder()
        .with('id', sharedId)
        .with('active', !spaceLink.active)
        .build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      billingApiMock.listPaymentLinks.mockImplementation((args) =>
        Promise.resolve(args?.upstreamCustomerId ? [spaceLink] : [generalLink]),
      );

      const result = await service.getSpacePaymentLinks({
        spaceId,
        spaceUuid,
        authPayload,
      });

      expect(result).toEqual([spaceLink]);
    });

    it('should always offer a space-specific link, regardless of the enforcement filter', async () => {
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      // A negotiated trial with no gracePeriod tag: the general catalog filter
      // would drop it, but a space-specific link is not subject to it.
      const negotiatedLink = paymentLinkBuilder()
        .with('trialPeriodDays', faker.number.int({ min: 1, max: 365 }))
        .build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      billingApiMock.listPaymentLinks.mockImplementation((args) =>
        Promise.resolve(args?.upstreamCustomerId ? [negotiatedLink] : []),
      );

      const result = await service.getSpacePaymentLinks({
        spaceId,
        spaceUuid,
        authPayload,
      });

      expect(result).toEqual([negotiatedLink]);
    });

    it('should throw when the user is not a space member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.getSpacePaymentLinks({
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.listPaymentLinks).not.toHaveBeenCalled();
    });

    it('should log an error when a trial link carries no recognized gracePeriod tag', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      // Tagged for neither side, so nobody is offered it: without a log the
      // catalog would just look emptier than it should.
      const untagged = trialPaymentLinkBuilder(true)
        .with('metadata', {})
        .build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      mockCatalog([untagged]);

      const result = await service.getSpacePaymentLinks({
        spaceId: faker.number.int(),
        spaceUuid: faker.string.uuid(),
        authPayload,
      });

      expect(result).toEqual([]);
      expect(loggingServiceMock.error).toHaveBeenCalledWith(
        expect.stringContaining(untagged.id),
      );
    });

    it('should not log an error when every trial link is tagged', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      mockCatalog([trialPaymentLinkBuilder(false).build()]);

      await service.getSpacePaymentLinks({
        spaceId: faker.number.int(),
        spaceUuid: faker.string.uuid(),
        authPayload,
      });

      expect(loggingServiceMock.error).not.toHaveBeenCalled();
    });

    it('should offer only the legacy grace link to a space created before the enforcement date', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const graceLink = trialPaymentLinkBuilder(true).build();
      const trialLink = trialPaymentLinkBuilder(false).build();
      // A never-subscribed space is not offered paid links yet — it has to
      // pick a trial first.
      const paidLink = paymentLinkBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      spaceCreatedAt(BEFORE_ENFORCEMENT);
      mockCatalog([graceLink, trialLink, paidLink]);

      const result = await service.getSpacePaymentLinks({
        spaceId: faker.number.int(),
        spaceUuid: faker.string.uuid(),
        authPayload,
      });

      expect(result).toEqual([graceLink]);
    });

    it('should offer only the standard trial link to a space created from the enforcement date on', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const graceLink = trialPaymentLinkBuilder(true).build();
      const trialLink = trialPaymentLinkBuilder(false).build();
      const paidLink = paymentLinkBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      // The boundary itself: enforcement starts at this instant.
      spaceCreatedAt(ENFORCEMENT_STARTS_AT);
      mockCatalog([graceLink, trialLink, paidLink]);

      const result = await service.getSpacePaymentLinks({
        spaceId: faker.number.int(),
        spaceUuid: faker.string.uuid(),
        authPayload,
      });

      expect(result).toEqual([trialLink]);
    });

    it('should offer only paid links to a space that has ever subscribed', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const graceLink = trialPaymentLinkBuilder(true).build();
      const paidLink = paymentLinkBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      spaceCreatedAt(BEFORE_ENFORCEMENT);
      subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
        hasEverSubscribed: true,
        activePlanName: null,
      });
      mockCatalog([graceLink, paidLink]);

      const result = await service.getSpacePaymentLinks({
        spaceId,
        spaceUuid: faker.string.uuid(),
        authPayload,
      });

      expect(result).toEqual([paidLink]);
      expect(
        subscriptionsRepositoryMock.getSubscriptionSummary,
      ).toHaveBeenCalledWith(spaceId);
    });

    it('should not offer the paid link matching the plan the space is already on', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const activeSubscription = spaceSubscriptionBuilder().build();
      const currentPlanLink = paymentLinkBuilder()
        .with('metadata', { planName: activeSubscription.planName })
        .build();
      const otherPlanLink = paymentLinkBuilder()
        .with('metadata', { planName: faker.commerce.productName() })
        .build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
        hasEverSubscribed: true,
        activePlanName: activeSubscription.planName,
      });
      mockCatalog([currentPlanLink, otherPlanLink]);

      const result = await service.getSpacePaymentLinks({
        spaceId,
        spaceUuid: faker.string.uuid(),
        authPayload,
      });

      expect(result).toEqual([otherPlanLink]);
    });

    it('should throw when the space no longer exists', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      spacesRepositoryMock.findCreatedAtById.mockRejectedValue(
        new NotFoundException('Workspace not found.'),
      );
      billingApiMock.listPaymentLinks.mockResolvedValue([]);

      await expect(
        service.getSpacePaymentLinks({
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCheckoutUrl', () => {
    it('should return the checkout session result for a space member', async () => {
      const paymentLinkId = faker.string.uuid();
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const returnUrl = withinRedirectOrigin();
      const checkoutSessionResult = checkoutSessionResultBuilder().build();
      const paymentLink = paymentLinkBuilder()
        .with('id', paymentLinkId)
        .build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      // A paid link needs the space to have subscribed before to be offered.
      subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
        hasEverSubscribed: true,
        activePlanName: null,
      });
      mockCatalog([paymentLink]);
      billingApiMock.createCheckoutSession.mockResolvedValue(
        checkoutSessionResult,
      );

      const result = await service.createCheckoutUrl({
        paymentLinkId,
        spaceId,
        spaceUuid,
        authPayload,
        returnUrl,
      });

      expect(result).toBe(checkoutSessionResult);
      expect(billingApiMock.createCheckoutSession).toHaveBeenCalledWith({
        paymentLinkId,
        upstreamCustomerId: spaceUuid,
        returnUrl: new URL(returnUrl, postLoginRedirectUri).toString(),
      });
    });

    it('should throw when the user is not a space member', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.createCheckoutUrl({
          paymentLinkId: faker.string.uuid(),
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
          returnUrl: withinRedirectOrigin(),
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should throw when returnUrl targets a disallowed origin', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());

      await expect(
        service.createCheckoutUrl({
          paymentLinkId: faker.string.uuid(),
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
          returnUrl: faker.internet.url(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(billingApiMock.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should throw when the payment link is not offered to the space', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      // The legacy grace, which a post-enforcement workspace is not entitled to.
      const graceLink = trialPaymentLinkBuilder(true).build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      spaceCreatedAt(AFTER_ENFORCEMENT);
      mockCatalog([graceLink]);

      await expect(
        service.createCheckoutUrl({
          paymentLinkId: graceLink.id,
          spaceId: faker.number.int(),
          spaceUuid: faker.string.uuid(),
          authPayload,
          returnUrl: withinRedirectOrigin(),
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should check out a payment link the space is offered', async () => {
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const returnUrl = withinRedirectOrigin();
      const graceLink = trialPaymentLinkBuilder(true).build();
      const checkoutSessionResult = checkoutSessionResultBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      spaceCreatedAt(BEFORE_ENFORCEMENT);
      mockCatalog([graceLink]);
      billingApiMock.createCheckoutSession.mockResolvedValue(
        checkoutSessionResult,
      );

      const result = await service.createCheckoutUrl({
        paymentLinkId: graceLink.id,
        spaceId: faker.number.int(),
        spaceUuid,
        authPayload,
        returnUrl,
      });

      expect(result).toBe(checkoutSessionResult);
      expect(billingApiMock.createCheckoutSession).toHaveBeenCalledWith({
        paymentLinkId: graceLink.id,
        upstreamCustomerId: spaceUuid,
        returnUrl,
      });
    });
  });

  describe('getCheckoutSession', () => {
    it('should return the checkout session mapped to camelCase', async () => {
      const sessionId = faker.string.alphanumeric(32);
      const checkoutSession = checkoutSessionBuilder().build();
      billingApiMock.getCheckoutSession.mockResolvedValue(checkoutSession);

      const result = await service.getCheckoutSession(sessionId);

      expect(result).toEqual(toCheckoutSessionDto(checkoutSession));
      expect(billingApiMock.getCheckoutSession).toHaveBeenCalledWith({
        sessionId,
      });
    });
  });

  /**
   * A subscribed workspace, offered a paid link priced at `planId`. Neither
   * plan-change endpoint is reachable without all three.
   */
  function subscribedSpace(args?: { planId?: string }): {
    spaceId: Space['id'];
    spaceUuid: Space['uuid'];
    planId: string;
    paymentLink: PaymentLink;
    subscription: Subscription;
  } {
    const planId = args?.planId ?? faker.string.alphanumeric(32);
    const paymentLink = paymentLinkPricedAt(planId).build();
    const subscription = subscriptionBuilder().with('status', 'active').build();

    subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
      // A paid link is only offered to a space that has subscribed before.
      hasEverSubscribed: true,
      activePlanName: null,
    });
    mockCatalog([paymentLink]);
    billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue([
      subscription,
    ]);

    return {
      spaceId: faker.number.int(),
      spaceUuid: fakeUuid(),
      planId,
      paymentLink,
      subscription,
    };
  }

  describe('previewSubscriptionUpdate', () => {
    it('should return the preview for a space member', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const preview = subscriptionUpdatePreviewBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      billingApiMock.previewSubscriptionUpdate.mockResolvedValue(preview);

      const result = await service.previewSubscriptionUpdate({
        spaceId,
        spaceUuid,
        subscriptionId: subscription.id,
        planId,
        authPayload,
      });

      expect(result).toBe(preview);
      expect(billingApiMock.previewSubscriptionUpdate).toHaveBeenCalledWith({
        upstreamCustomerId: spaceUuid,
        subscriptionId: subscription.id,
        planId,
      });
    });

    it('should throw when the user is not a space member', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.previewSubscriptionUpdate({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.previewSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it('should throw when the plan is not offered to the space', async () => {
      const { spaceId, spaceUuid, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());

      await expect(
        service.previewSubscriptionUpdate({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId: faker.string.alphanumeric(32),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.previewSubscriptionUpdate).not.toHaveBeenCalled();
    });

    it('should throw when the subscription does not belong to the space', async () => {
      const { spaceId, spaceUuid, planId } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());

      await expect(
        service.previewSubscriptionUpdate({
          spaceId,
          spaceUuid,
          subscriptionId: faker.string.alphanumeric(32),
          planId,
          authPayload,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(billingApiMock.previewSubscriptionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateSubscription', () => {
    // `assertMember` only checks that the lookup returns a row.
    function asMember(): void {
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
    }

    it('should move the subscription onto the plan, sourcing metadata from the offered link', async () => {
      const { spaceId, spaceUuid, planId, paymentLink, subscription } =
        subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const updateResult = updateSubscriptionResultBuilder().build();
      asMember();
      billingApiMock.updateSubscription.mockResolvedValue(updateResult);

      const result = await service.updateSubscription({
        spaceId,
        spaceUuid,
        subscriptionId: subscription.id,
        planId,
        authPayload,
      });

      expect(result).toBe(updateResult);
      expect(billingApiMock.updateSubscription).toHaveBeenCalledWith({
        upstreamCustomerId: spaceUuid,
        subscriptionId: subscription.id,
        planId,
        // Derived, never taken from the caller.
        paymentLinkId: paymentLink.id,
      });
    });

    it('should throw when the user is not a space member', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when not authenticated', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload: new AuthPayload(),
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when the plan is not offered to the space', async () => {
      const { spaceId, spaceUuid, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      asMember();

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId: faker.string.alphanumeric(32),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when the subscription does not belong to the space', async () => {
      const { spaceId, spaceUuid, planId } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      asMember();

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: faker.string.alphanumeric(32),
          planId,
          authPayload,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when the workspace is already on the target plan', async () => {
      const planId = faker.string.alphanumeric(32);
      const { spaceId, spaceUuid, subscription } = subscribedSpace({ planId });
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      asMember();
      // The price in force is the one being asked for.
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue([
        {
          ...subscription,
          plan: { ...subscription.plan, id: planId },
        },
      ]);

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload,
        }),
      ).rejects.toThrow(ConflictException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it.each(['canceled', 'past_due', 'paused', 'unpaid'] as const)(
      'should throw when the subscription is %s rather than active',
      async (status) => {
        const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
        const authPayload = new AuthPayload(
          siweAuthPayloadDtoBuilder().build(),
        );
        asMember();
        billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue([
          { ...subscription, status },
        ]);

        await expect(
          service.updateSubscription({
            spaceId,
            spaceUuid,
            subscriptionId: subscription.id,
            planId,
            authPayload,
          }),
        ).rejects.toThrow(ConflictException);

        expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
      },
    );

    it('should honour an explicit paymentLinkId that sells the plan', async () => {
      const { spaceId, spaceUuid, planId, paymentLink, subscription } =
        subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const updateResult = updateSubscriptionResultBuilder().build();
      asMember();
      billingApiMock.updateSubscription.mockResolvedValue(updateResult);

      await service.updateSubscription({
        spaceId,
        spaceUuid,
        subscriptionId: subscription.id,
        planId,
        paymentLinkId: paymentLink.id,
        authPayload,
      });

      expect(billingApiMock.updateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ paymentLinkId: paymentLink.id }),
      );
    });

    it('should throw when the named paymentLinkId does not sell the plan', async () => {
      const { spaceId, spaceUuid, planId, paymentLink, subscription } =
        subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      // Offered to the space, but priced at another plan.
      const otherLink = paymentLinkPricedAt(
        faker.string.alphanumeric(32),
      ).build();
      mockCatalog([paymentLink, otherLink]);
      asMember();

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          paymentLinkId: otherLink.id,
          authPayload,
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when the named paymentLinkId is not offered to the space', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      asMember();

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          // A link that is in no catalog at all.
          paymentLinkId: faker.string.alphanumeric(32),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      // Never quietly swapped for the link that does sell the plan.
      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when several offered links sell the plan and none was named', async () => {
      const planId = faker.string.alphanumeric(32);
      const { spaceId, spaceUuid, paymentLink, subscription } = subscribedSpace(
        { planId },
      );
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      // A second link at the same price, with its own metadata.
      const negotiatedLink = paymentLinkPricedAt(planId).build();
      mockCatalog([paymentLink, negotiatedLink]);
      asMember();

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload,
        }),
      ).rejects.toThrow(ConflictException);

      expect(loggingServiceMock.error).toHaveBeenCalled();
      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should let an explicit paymentLinkId break that tie', async () => {
      const planId = faker.string.alphanumeric(32);
      const { spaceId, spaceUuid, paymentLink, subscription } = subscribedSpace(
        { planId },
      );
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const negotiatedLink = paymentLinkPricedAt(planId).build();
      const updateResult = updateSubscriptionResultBuilder().build();
      mockCatalog([paymentLink, negotiatedLink]);
      asMember();
      billingApiMock.updateSubscription.mockResolvedValue(updateResult);

      await service.updateSubscription({
        spaceId,
        spaceUuid,
        subscriptionId: subscription.id,
        planId,
        paymentLinkId: negotiatedLink.id,
        authPayload,
      });

      expect(billingApiMock.updateSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ paymentLinkId: negotiatedLink.id }),
      );
    });

    it('should answer 409, not 403, when the plan in force is filtered out of the offer', async () => {
      const planId = faker.string.alphanumeric(32);
      const { spaceId, spaceUuid, paymentLink, subscription } = subscribedSpace(
        { planId },
      );
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      asMember();
      // `isOfferedToSpace` drops the link whose plan the space already holds.
      subscriptionsRepositoryMock.getSubscriptionSummary.mockResolvedValue({
        hasEverSubscribed: true,
        activePlanName: planNameOf(paymentLink),
      });
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue([
        { ...subscription, plan: { ...subscription.plan, id: planId } },
      ]);

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload,
        }),
      ).rejects.toThrow(ConflictException);

      expect(billingApiMock.updateSubscription).not.toHaveBeenCalled();
    });

    it('should throw when the upstream reports the change as unsuccessful', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      asMember();
      billingApiMock.updateSubscription.mockResolvedValue(
        updateSubscriptionResultBuilder().with('success', false).build(),
      );

      await expect(
        service.updateSubscription({
          spaceId,
          spaceUuid,
          subscriptionId: subscription.id,
          planId,
          authPayload,
        }),
      ).rejects.toThrow(BadGatewayException);

      expect(loggingServiceMock.error).toHaveBeenCalled();
    });

    it('should allow a trialing subscription to change plan', async () => {
      const { spaceId, spaceUuid, planId, subscription } = subscribedSpace();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const updateResult = updateSubscriptionResultBuilder().build();
      asMember();
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue([
        { ...subscription, status: 'trialing' },
      ]);
      billingApiMock.updateSubscription.mockResolvedValue(updateResult);

      const result = await service.updateSubscription({
        spaceId,
        spaceUuid,
        subscriptionId: subscription.id,
        planId,
        authPayload,
      });

      expect(result).toBe(updateResult);
    });
  });
});
