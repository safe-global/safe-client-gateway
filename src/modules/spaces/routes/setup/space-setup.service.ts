// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import {
  getRedirectConfig,
  type RedirectConfig,
  resolveAndValidateRedirectUrl,
} from '#/modules/auth/utils/auth-redirect.helper';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import type {
  SpaceSetup,
  SpaceSetupPayload,
  SpaceSetupSurvey,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { SpaceSetupCheckoutFailedError } from '#/modules/spaces/domain/setup/errors/space-setup-checkout-failed.error';
import { ISpaceSetupApplier } from '#/modules/spaces/domain/setup/space-setup-applier.interface';
import { ISpaceSetupBilling } from '#/modules/spaces/domain/setup/space-setup-billing.interface';
import { buildSetupPayload } from '#/modules/spaces/domain/setup/space-setup-payload.mapper';
import {
  assertPlanChoice,
  assertSeatsFit,
  countSeatsWith,
  countSetupSeats,
  findOfferedPaymentLink,
} from '#/modules/spaces/domain/setup/space-setup-plan.rules';
import { ISpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository.interface';
import { assertAdmin } from '#/modules/spaces/domain/space-assert.utils';
import { activateSpaceCreator } from '#/modules/spaces/domain/space-creator.utils';
import { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import {
  type CreateSpaceSetupDto,
  SPACE_SETUP_STATUS_DTO,
  type SpaceSetupCheckoutDto,
  type SpaceSetupDto,
} from '#/modules/spaces/routes/entities/space-setup.dto.entity';
import { validateSurveyAnswer } from '#/modules/surveys/domain/survey-answer.utils';
import { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { IUsersRepository } from '#/modules/users/domain/users.repository.interface';

const SETUP_NOT_PENDING_MESSAGE =
  'The Workspace setup is finished and can no longer change';

/**
 * Coordinates a Workspace setup: the form is checked by the setup rules, the
 * Workspace and its pending setup are written together, and then either the
 * plan's checkout starts or, with no plan, the setup is applied at once.
 */
@Injectable()
export class SpaceSetupService {
  private readonly redirectConfig: RedirectConfig;
  private readonly maxInvites: number;

  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(ISpaceSetupsRepository)
    private readonly spaceSetupsRepository: ISpaceSetupsRepository,
    @Inject(ISurveysRepository)
    private readonly surveysRepository: ISurveysRepository,
    @Inject(ISpaceSetupApplier)
    private readonly spaceSetupApplier: ISpaceSetupApplier,
    @Inject(ISpaceSetupBilling)
    private readonly billing: ISpaceSetupBilling,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.redirectConfig = getRedirectConfig(configurationService);
    this.maxInvites =
      configurationService.getOrThrow<number>('spaces.maxInvites');
  }

  /**
   * Checks the whole form first, then writes the Workspace, its creator and
   * the pending setup in one transaction. The KMS calls that encrypt the name
   * and the payload need the new space id, so they run inside it; the billing
   * calls do not.
   */
  public async create(args: {
    authPayload: AuthPayload;
    body: CreateSpaceSetupDto;
  }): Promise<SpaceSetupCheckoutDto> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const returnUrl = this.validateReturnUrl(args.body.returnUrl);
    const payload = await this.buildPayload(args.body);
    const { paymentLinkId } = args.body;
    await this.assertPlanFits({
      paymentLinkId,
      listOfferedLinks: () => this.billing.listTrialPlans(),
      countSeats: () => Promise.resolve(countSetupSeats(payload.safes)),
    });

    await activateSpaceCreator(this.usersRepository, userId);
    const space = await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        const created = await this.spacesRepository.create({
          userId,
          name: args.body.name,
          status: 'ACTIVE',
          entityManager,
        });
        await this.spaceSetupsRepository.createPending({
          spaceId: created.id,
          paymentLinkId,
          payload,
          entityManager,
        });
        return created;
      },
    );

    const checkoutUrl = await this.finish(
      { spaceId: space.id, paymentLinkId },
      (planId) =>
        this.startCheckout({
          spaceUuid: space.uuid,
          paymentLinkId: planId,
          returnUrl,
        }).catch((error: unknown) => {
          this.loggingService.error(
            `Checkout for the new space ${space.uuid} did not start: ${asError(error).message}`,
          );
          throw new SpaceSetupCheckoutFailedError(space.uuid, error);
        }),
    );
    return { spaceId: space.uuid, checkoutUrl };
  }

  /**
   * The setup as the client submitted it, after reconciling it, so a lost
   * webhook cannot leave the Workspace waiting.
   */
  public async get(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
  }): Promise<SpaceSetupDto> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    await this.tryReconcileTrial(args.spaceId);
    return this.toSetupDto(await this.findSetupOrFail(args.spaceId));
  }

  /**
   * Replaces the form of a setup whose trial has not started, after a
   * cancelled checkout, and starts a new checkout. The setup is reconciled
   * first, so a trial that did start is applied and refused here.
   */
  public async update(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    body: CreateSpaceSetupDto;
  }): Promise<SpaceSetupCheckoutDto> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);
    const returnUrl = this.validateReturnUrl(args.body.returnUrl);
    const payload = await this.buildPayload(args.body);

    await this.reconcileTrial(args.spaceId);
    const setup = await this.findSetupOrFail(args.spaceId);
    if (setup.status !== 'PENDING') {
      throw new ConflictException(SETUP_NOT_PENDING_MESSAGE);
    }
    const spaceUuid = await this.spacesRepository.findUuidById(args.spaceId);
    const { paymentLinkId } = args.body;
    await this.assertPlanFits({
      paymentLinkId,
      listOfferedLinks: () =>
        this.billing.listOfferedPaymentLinks({
          spaceId: args.spaceId,
          spaceUuid,
        }),
      countSeats: () =>
        countSeatsWith(this.spaceSafesRepository, {
          spaceId: args.spaceId,
          safes: payload.safes,
        }),
    });

    await this.replaceSetup({
      spaceId: args.spaceId,
      actorUserId: userId,
      name: args.body.name,
      paymentLinkId,
      payload,
    });

    const checkoutUrl = await this.finish(
      { spaceId: args.spaceId, paymentLinkId },
      (planId) =>
        this.startCheckout({ spaceUuid, paymentLinkId: planId, returnUrl }),
    );
    return { spaceId: spaceUuid, checkoutUrl };
  }

  /**
   * Brings a pending setup to where it belongs: applied once nothing holds it
   * back — it has no plan to buy, or the plan's trial is live. Writes: it
   * stores the subscription it reads and applies the setup.
   */
  private async reconcileTrial(spaceId: Space['id']): Promise<void> {
    const setup = await this.spaceSetupsRepository.findStateBySpaceId(spaceId);
    if (!setup || setup.status === 'APPLIED') {
      return;
    }
    const isReady =
      setup.paymentLinkId === null ||
      (await this.billing.syncSubscription({
        spaceId,
        spaceUuid: await this.spacesRepository.findUuidById(spaceId),
      }));
    if (isReady) {
      await this.spaceSetupApplier.apply(spaceId);
    }
  }

  /** {@link reconcileTrial}, logged rather than thrown: a read must not fail because billing is down. */
  private async tryReconcileTrial(spaceId: Space['id']): Promise<void> {
    try {
      await this.reconcileTrial(spaceId);
    } catch (error) {
      this.loggingService.warn(
        `Could not reconcile the setup of space ${spaceId}: ${asError(error).message}`,
      );
    }
  }

  /** The plan choice, the offered link and its seats, checked before any write. */
  private async assertPlanFits(args: {
    paymentLinkId: string | null;
    listOfferedLinks: () => Promise<Array<PaymentLink>>;
    countSeats: () => Promise<number>;
  }): Promise<void> {
    assertPlanChoice({
      paymentLinkId: args.paymentLinkId,
      isBillingAvailable: this.billing.isAvailable(),
      isBillingEnforced: this.billing.isEnforced(),
    });
    if (args.paymentLinkId === null) {
      return;
    }
    assertSeatsFit({
      paymentLink: findOfferedPaymentLink(
        await args.listOfferedLinks(),
        args.paymentLinkId,
      ),
      seats: await args.countSeats(),
      onInvalidQuota: (message) => this.loggingService.warn(message),
    });
  }

  private async replaceSetup(args: {
    spaceId: Space['id'];
    actorUserId: number;
    name: Space['name'];
    paymentLinkId: string | null;
    payload: SpaceSetupPayload;
  }): Promise<void> {
    await this.postgresDatabaseService.transaction(async (entityManager) => {
      const locked = await this.spaceSetupsRepository.findBySpaceIdForUpdate(
        args.spaceId,
        entityManager,
      );
      if (locked?.status !== 'PENDING') {
        throw new ConflictException(SETUP_NOT_PENDING_MESSAGE);
      }
      await this.spacesRepository.update({
        id: args.spaceId,
        updatePayload: { name: args.name },
        actorUserId: args.actorUserId,
        entityManager,
      });
      await this.spaceSetupsRepository.replace({
        spaceId: args.spaceId,
        paymentLinkId: args.paymentLinkId,
        payload: args.payload,
        entityManager,
      });
    });
  }

  /**
   * With no plan, applies the setup now; with one, starts its checkout. A
   * failed apply is logged, not thrown: the Workspace is committed, and the
   * next read of the setup applies it.
   *
   * @returns the checkout URL, or `null` without a plan.
   */
  private async finish(
    args: { spaceId: Space['id']; paymentLinkId: string | null },
    startCheckout: (paymentLinkId: string) => Promise<string>,
  ): Promise<string | null> {
    if (args.paymentLinkId !== null) {
      return await startCheckout(args.paymentLinkId);
    }
    try {
      await this.spaceSetupApplier.apply(args.spaceId);
    } catch (error) {
      this.loggingService.warn(
        `Could not apply the setup of space ${args.spaceId}: ${asError(error).message}`,
      );
    }
    return null;
  }

  private async startCheckout(args: {
    spaceUuid: Space['uuid'];
    paymentLinkId: string;
    returnUrl: string;
  }): Promise<string> {
    const session = await this.billing.createCheckoutSession(args);
    return session.url;
  }

  private async buildPayload(
    body: CreateSpaceSetupDto,
  ): Promise<SpaceSetupPayload> {
    return buildSetupPayload({
      form: {
        safes: body.safes,
        addressBookItems: body.addressBookItems,
        invites: body.invites,
        survey: body.survey && (await this.checkSurveyAnswer(body.survey)),
      },
      maxInvites: this.maxInvites,
    });
  }

  private async checkSurveyAnswer(
    survey: SpaceSetupSurvey,
  ): Promise<SpaceSetupSurvey> {
    const { selections } = await validateSurveyAnswer(
      this.surveysRepository,
      survey,
    );
    return { slug: survey.slug, selections };
  }

  private validateReturnUrl(returnUrl: string): string {
    return resolveAndValidateRedirectUrl(this.redirectConfig, returnUrl);
  }

  private async findSetupOrFail(spaceId: Space['id']): Promise<SpaceSetup> {
    const setup = await this.spaceSetupsRepository.findBySpaceId(spaceId);
    if (!setup) {
      throw new NotFoundException('This Workspace has no setup');
    }
    return setup;
  }

  private toSetupDto(setup: SpaceSetup): SpaceSetupDto {
    return {
      status: SPACE_SETUP_STATUS_DTO[setup.status],
      paymentLinkId: setup.paymentLinkId,
      safes: setup.payload.safes,
      addressBookItems: setup.payload.addressBookItems,
      invites: setup.payload.invites,
      survey: setup.payload.survey,
    };
  }
}
