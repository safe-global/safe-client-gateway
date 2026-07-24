// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import {
  checkoutSessionBuilder,
  checkoutSessionResultBuilder,
} from '@/datasources/billing-api/entities/__tests__/checkout-session.builder';
import { paymentLinkBuilder } from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import { planBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { BillingService } from '@/modules/billing/routes/billing.service';
import { toCheckoutSessionDto } from '@/modules/billing/routes/entities/checkout-session.entity';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const billingApiMock = {
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  getCustomer: vi.fn(),
  getCustomerSessionUrl: vi.fn(),
  getSubscriptionsByCustomerId: vi.fn(),
  listPaymentLinks: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
} as MockedObject<IBillingApi>;

const membersRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

describe('BillingService', () => {
  let service: BillingService;
  let postLoginRedirectUri: string;

  function withinRedirectOrigin(): string {
    return new URL(faker.system.filePath(), postLoginRedirectUri).toString();
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

    service = new BillingService(
      billingApiMock,
      membersRepositoryMock,
      fakeConfigurationService,
    );
  });

  describe('getSubscriptions', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should return subscriptions for %s space members', async (_label, builder) => {
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(builder().build());
      const subscriptions = [subscriptionBuilder().build()];
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
      billingApiMock.getSubscriptionsByCustomerId.mockResolvedValue(
        subscriptions,
      );

      const result = await service.getSubscriptions({
        spaceId,
        spaceUuid,
        authPayload,
      });

      expect(result).toBe(subscriptions);
      expect(billingApiMock.getSubscriptionsByCustomerId).toHaveBeenCalledWith({
        upstreamCustomerId: spaceUuid,
        status: undefined,
      });
    });

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
  });

  describe('createCheckoutUrl', () => {
    it('should return the checkout session result for a space member', async () => {
      const paymentLinkId = faker.string.uuid();
      const spaceId = faker.number.int();
      const spaceUuid = faker.string.uuid();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const returnUrl = withinRedirectOrigin();
      const checkoutSessionResult = checkoutSessionResultBuilder().build();
      membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
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
});
