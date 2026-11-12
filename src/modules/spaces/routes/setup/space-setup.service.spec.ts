// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { checkoutSessionResultBuilder } from '#/datasources/billing-api/entities/__tests__/checkout-session.builder';
import { trialPaymentLinkBuilder } from '#/datasources/billing-api/entities/__tests__/payment-link.builder';
import type { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '#/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { spaceSetupBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import type { SpaceSetup } from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { PlanNotOfferedError } from '#/modules/spaces/domain/setup/errors/plan-not-offered.error';
import { SpaceSetupCheckoutFailedError } from '#/modules/spaces/domain/setup/errors/space-setup-checkout-failed.error';
import type { ISpaceSetupApplier } from '#/modules/spaces/domain/setup/space-setup-applier.interface';
import type { ISpaceSetupBilling } from '#/modules/spaces/domain/setup/space-setup-billing.interface';
import type { ISpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository.interface';
import type { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import { createSpaceSetupDtoBuilder } from '#/modules/spaces/routes/entities/__tests__/create-space-setup.dto.builder';
import type { CreateSpaceSetupDto } from '#/modules/spaces/routes/entities/space-setup.dto.entity';
import { SpaceSetupService } from '#/modules/spaces/routes/setup/space-setup.service';
import type { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import type { IUsersRepository } from '#/modules/users/domain/users.repository.interface';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

/**
 * The service only coordinates; the rules it applies have their own specs.
 * These cover which branch runs: checkout or apply, reconcile on read and on
 * replace, and the 502 that carries the new Workspace's id.
 */
describe('SpaceSetupService', () => {
  const entityManager = {} as EntityManager;
  let postLoginRedirectUri: string;
  let spacesRepository: MockedObject<ISpacesRepository>;
  let membersRepository: MockedObject<IMembersRepository>;
  let spaceSetupsRepository: MockedObject<ISpaceSetupsRepository>;
  let applier: MockedObject<ISpaceSetupApplier>;
  let billing: MockedObject<ISpaceSetupBilling>;
  let loggingService: MockedObject<ILoggingService>;
  let authPayload: AuthPayload;
  let space: Pick<Space, 'id' | 'uuid' | 'name'>;
  let target: SpaceSetupService;

  function withinRedirectOrigin(): string {
    return new URL(faker.system.filePath(), postLoginRedirectUri).toString();
  }

  /** A form for `paymentLinkId` whose return URL is allowed. */
  function form(paymentLinkId: string | null): CreateSpaceSetupDto {
    return createSpaceSetupDtoBuilder()
      .with('paymentLinkId', paymentLinkId)
      .with('returnUrl', withinRedirectOrigin())
      .build();
  }

  beforeEach(() => {
    postLoginRedirectUri = faker.internet.url();
    const configurationService = new FakeConfigurationService();
    configurationService.set('auth.postLoginRedirectUri', postLoginRedirectUri);
    configurationService.set('application.isProduction', false);
    configurationService.set(
      'spaces.maxInvites',
      faker.number.int({ min: 5, max: 10 }),
    );

    space = {
      id: faker.number.int({ min: 1 }),
      uuid: fakeUuid(),
      name: faker.word.noun(),
    };
    const postgresDatabaseService = {
      transaction: vi.fn((fn: (em: EntityManager) => Promise<unknown>) =>
        fn(entityManager),
      ),
    } as MockedObject<PostgresDatabaseService>;
    const usersRepository = {
      findOneOrFail: vi.fn(),
      activateIfPending: vi.fn(),
    } as MockedObject<IUsersRepository>;
    spacesRepository = {
      create: vi.fn().mockResolvedValue(space),
      update: vi.fn(),
      findUuidById: vi.fn().mockResolvedValue(space.uuid),
    } as MockedObject<ISpacesRepository>;
    membersRepository = {
      findOne: vi
        .fn()
        .mockResolvedValue(
          memberBuilder()
            .with('role', 'ADMIN')
            .with('status', 'ACTIVE')
            .build(),
        ),
    } as MockedObject<IMembersRepository>;
    const spaceSafesRepository = {
      countSeatsBySpaceId: vi.fn().mockResolvedValue(0),
      countNewSeats: vi.fn().mockResolvedValue(0),
    } as MockedObject<ISpaceSafesRepository>;
    spaceSetupsRepository = {
      createPending: vi.fn(),
      findBySpaceId: vi.fn(),
      findStateBySpaceId: vi.fn(),
      findBySpaceIdForUpdate: vi.fn(),
      replace: vi.fn(),
    } as MockedObject<ISpaceSetupsRepository>;
    const surveysRepository = {
      findActiveBySlugOrFail: vi.fn(),
    } as MockedObject<ISurveysRepository>;
    applier = { apply: vi.fn() };
    billing = {
      isAvailable: vi.fn().mockReturnValue(true),
      isEnforced: vi.fn().mockReturnValue(true),
      listTrialPlans: vi.fn(),
      listOfferedPaymentLinks: vi.fn(),
      createCheckoutSession: vi.fn(),
      syncSubscription: vi.fn().mockResolvedValue(false),
    };
    loggingService = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as MockedObject<ILoggingService>;
    authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());

    target = new SpaceSetupService(
      postgresDatabaseService,
      usersRepository,
      spacesRepository,
      membersRepository,
      spaceSafesRepository,
      spaceSetupsRepository,
      surveysRepository,
      applier,
      billing,
      configurationService,
      loggingService,
    );
  });

  /** The stored setup the reads find, pending unless overridden. */
  function storedSetup(overrides: Partial<SpaceSetup> = {}): void {
    const setup = {
      ...spaceSetupBuilder().with('spaceId', space.id).build(),
      ...overrides,
    };
    spaceSetupsRepository.findStateBySpaceId.mockResolvedValue(setup);
    spaceSetupsRepository.findBySpaceId.mockResolvedValue(setup);
    spaceSetupsRepository.findBySpaceIdForUpdate.mockResolvedValue(setup);
  }

  describe('create', () => {
    it('stores a pending setup with the plan and returns its checkout', async () => {
      const plan = trialPaymentLinkBuilder(false).build();
      const session = checkoutSessionResultBuilder().build();
      billing.listTrialPlans.mockResolvedValue([plan]);
      billing.createCheckoutSession.mockResolvedValue(session);
      const body = form(plan.id);

      await expect(target.create({ authPayload, body })).resolves.toEqual({
        spaceId: space.uuid,
        checkoutUrl: session.url,
      });
      expect(spaceSetupsRepository.createPending).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: space.id,
          paymentLinkId: plan.id,
          payload: expect.objectContaining({ safes: body.safes }),
        }),
      );
      expect(applier.apply).not.toHaveBeenCalled();
    });

    it('applies a setup without a plan at once', async () => {
      billing.isEnforced.mockReturnValue(false);

      await expect(
        target.create({ authPayload, body: form(null) }),
      ).resolves.toEqual({ spaceId: space.uuid, checkoutUrl: null });
      expect(applier.apply).toHaveBeenCalledWith(space.id);
      expect(billing.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('writes nothing when the rules refuse the plan', async () => {
      billing.listTrialPlans.mockResolvedValue([
        trialPaymentLinkBuilder(false).build(),
      ]);

      await expect(
        target.create({
          authPayload,
          body: form(faker.string.alphanumeric(16)),
        }),
      ).rejects.toThrow(PlanNotOfferedError);
      expect(spacesRepository.create).not.toHaveBeenCalled();
    });

    it('writes nothing for a return URL outside the allowlist', async () => {
      const body = createSpaceSetupDtoBuilder()
        .with('returnUrl', 'https://attacker.example/return')
        .build();

      await expect(target.create({ authPayload, body })).rejects.toThrow(
        BadRequestException,
      );
      expect(spacesRepository.create).not.toHaveBeenCalled();
    });

    it('carries the new Workspace id when the checkout cannot start', async () => {
      const plan = trialPaymentLinkBuilder(false).build();
      billing.listTrialPlans.mockResolvedValue([plan]);
      billing.createCheckoutSession.mockRejectedValue(
        new Error('upstream down'),
      );

      const error = await target
        .create({ authPayload, body: form(plan.id) })
        .catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(SpaceSetupCheckoutFailedError);
      expect(error).toHaveProperty('spaceUuid', space.uuid);
      expect(spaceSetupsRepository.createPending).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('applies a setup whose trial is live before reading it', async () => {
      storedSetup();
      billing.syncSubscription.mockResolvedValue(true);

      await target.get({ spaceId: space.id, authPayload });

      expect(billing.syncSubscription).toHaveBeenCalledWith({
        spaceId: space.id,
        spaceUuid: space.uuid,
      });
      expect(applier.apply).toHaveBeenCalledWith(space.id);
    });

    it('leaves a setup whose trial has not started', async () => {
      storedSetup();

      const result = await target.get({ spaceId: space.id, authPayload });

      expect(result.status).toBe('pending');
      expect(applier.apply).not.toHaveBeenCalled();
    });

    it('applies a pending setup without a plan, asking billing nothing', async () => {
      storedSetup({ paymentLinkId: null });

      await target.get({ spaceId: space.id, authPayload });

      expect(applier.apply).toHaveBeenCalledWith(space.id);
      expect(billing.syncSubscription).not.toHaveBeenCalled();
    });

    it('returns the stored setup when the reconcile fails', async () => {
      storedSetup();
      billing.syncSubscription.mockRejectedValue(new Error('timeout'));

      const result = await target.get({ spaceId: space.id, authPayload });

      expect(result.status).toBe('pending');
      expect(loggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('timeout'),
      );
    });

    it('answers 404 when the space has no setup', async () => {
      spaceSetupsRepository.findStateBySpaceId.mockResolvedValue(null);
      spaceSetupsRepository.findBySpaceId.mockResolvedValue(null);

      await expect(
        target.get({ spaceId: space.id, authPayload }),
      ).rejects.toThrow(NotFoundException);
    });

    it('answers 403 to a caller who is not an admin', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        target.get({ spaceId: space.id, authPayload }),
      ).rejects.toThrow(ForbiddenException);
      expect(billing.syncSubscription).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('replaces a pending setup and returns a new checkout', async () => {
      storedSetup();
      const plan = trialPaymentLinkBuilder(false).build();
      const session = checkoutSessionResultBuilder().build();
      billing.listOfferedPaymentLinks.mockResolvedValue([plan]);
      billing.createCheckoutSession.mockResolvedValue(session);
      const body = form(plan.id);

      await expect(
        target.update({ spaceId: space.id, authPayload, body }),
      ).resolves.toEqual({ spaceId: space.uuid, checkoutUrl: session.url });
      expect(spaceSetupsRepository.replace).toHaveBeenCalledWith(
        expect.objectContaining({ paymentLinkId: plan.id }),
      );
      expect(spacesRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ updatePayload: { name: body.name } }),
      );
    });

    it('applies a setup whose trial is live, then refuses to replace it', async () => {
      storedSetup();
      billing.syncSubscription.mockResolvedValue(true);
      spaceSetupsRepository.findBySpaceId.mockResolvedValue(
        spaceSetupBuilder().with('status', 'APPLIED').build(),
      );

      await expect(
        target.update({ spaceId: space.id, authPayload, body: form(null) }),
      ).rejects.toThrow(ConflictException);
      expect(applier.apply).toHaveBeenCalledWith(space.id);
      expect(spaceSetupsRepository.replace).not.toHaveBeenCalled();
    });

    it('refuses to replace a setup another request claimed meanwhile', async () => {
      storedSetup();
      spaceSetupsRepository.findBySpaceIdForUpdate.mockResolvedValue(
        spaceSetupBuilder().with('status', 'APPLYING').build(),
      );
      const plan = trialPaymentLinkBuilder(false).build();
      billing.listOfferedPaymentLinks.mockResolvedValue([plan]);

      await expect(
        target.update({ spaceId: space.id, authPayload, body: form(plan.id) }),
      ).rejects.toThrow(ConflictException);
      expect(spaceSetupsRepository.replace).not.toHaveBeenCalled();
      expect(billing.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('applies the new form at once when it has no plan', async () => {
      storedSetup();
      billing.isEnforced.mockReturnValue(false);

      await expect(
        target.update({ spaceId: space.id, authPayload, body: form(null) }),
      ).resolves.toEqual({ spaceId: space.uuid, checkoutUrl: null });
      expect(spaceSetupsRepository.replace).toHaveBeenCalledWith(
        expect.objectContaining({ paymentLinkId: null }),
      );
      expect(applier.apply).toHaveBeenCalledWith(space.id);
    });
  });
});
