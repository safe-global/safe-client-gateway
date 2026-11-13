// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { groupBy } from 'lodash';
import { IsNull } from 'typeorm';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { UniqueConstraintError } from '#/datasources/errors/unique-constraint-error';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { QuotaExceededError } from '#/modules/entitlements/domain/errors/quota-exceeded.error';
import { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { AddressBookItem } from '#/modules/spaces/domain/address-books/entities/address-book-item.entity';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import type {
  SpaceSetupSafe,
  SpaceSetupSurvey,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import type { ISpaceSetupApplier } from '#/modules/spaces/domain/setup/space-setup-applier.interface';
import { ISpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository.interface';
import { MembersService } from '#/modules/spaces/routes/members/members.service';
import { SpaceSafesService } from '#/modules/spaces/routes/safes/space-safes.service';
import { InvalidSurveySelectionsError } from '#/modules/surveys/domain/errors/invalid-survey-selections.error';
import { validateSurveyAnswer } from '#/modules/surveys/domain/survey-answer.utils';
import { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';
import type { InviteUserInput } from '#/modules/users/domain/entities/invite-user.entity';
import type { User } from '#/modules/users/domain/entities/user.entity';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

/**
 * Applies a setup on behalf of the Workspace's creator, through the same
 * services as the requests it replaces, so the seat quota, encryption, audit
 * and invite emails behave as they do there.
 *
 * The setup is claimed in a short transaction of its own and applied outside
 * it, so no row lock or pooled connection is held across the KMS and email
 * calls. A Safe, contact, invite or survey answer that no longer fits is
 * logged and skipped. Any other failure propagates and leaves the setup
 * APPLYING: the next apply claims it again once the lease has run out.
 */
@Injectable()
export class SpaceSetupApplyService implements ISpaceSetupApplier {
  private readonly applyLeaseSeconds: number;

  public constructor(
    @Inject(ISpaceSetupsRepository)
    private readonly spaceSetupsRepository: ISpaceSetupsRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IAddressBookItemsRepository)
    private readonly addressBookItemsRepository: IAddressBookItemsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISurveysRepository)
    private readonly surveysRepository: ISurveysRepository,
    private readonly spaceSafesService: SpaceSafesService,
    private readonly membersService: MembersService,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.applyLeaseSeconds = configurationService.getOrThrow<number>(
      'spaces.setup.applyLeaseSeconds',
    );
  }

  public async apply(spaceId: Space['id']): Promise<void> {
    const setup = await this.spaceSetupsRepository.claim({
      spaceId,
      leaseSeconds: this.applyLeaseSeconds,
    });
    if (!setup) {
      return;
    }
    const creatorId = await this.findCreatorIdOrFail(spaceId);
    const { safes, addressBookItems, invites, survey } = setup.payload;

    await this.addSafes({ spaceId, creatorId, safes, addressBookItems });
    await this.inviteMembers({ spaceId, creatorId, invites });
    if (survey) {
      await this.saveSurvey({ spaceId, creatorId, survey });
    }
    const isApplied = await this.spaceSetupsRepository.markApplied({
      spaceId,
      claimId: setup.claimId,
    });
    this.loggingService.info(
      isApplied
        ? `Applied the setup of space ${spaceId}`
        : `Lost the claim on the setup of space ${spaceId} to a later apply`,
    );
  }

  /** The only admin nobody invited: the setup adds no member before it. */
  private async findCreatorIdOrFail(spaceId: Space['id']): Promise<number> {
    const creator = await this.membersRepository.findOne(
      {
        space: { id: spaceId },
        role: 'ADMIN',
        status: 'ACTIVE',
        invitedBy: IsNull(),
      },
      { user: true },
    );
    if (!creator) {
      throw new Error(`Space ${spaceId} has no creator to apply its setup as`);
    }
    return creator.user.id;
  }

  /**
   * One call per address, so one Safe that no longer fits skips only itself,
   * and its contact is stored with it or not at all.
   */
  private async addSafes(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    safes: Array<SpaceSetupSafe>;
    addressBookItems: Array<AddressBookItem>;
  }): Promise<void> {
    const safesByAddress = groupBy(args.safes, (safe) =>
      safe.address.toLowerCase(),
    );

    for (const [address, chainSafes] of Object.entries(safesByAddress)) {
      const newSafes = await this.withoutHeldSafes(args.spaceId, chainSafes);
      if (newSafes.length === 0) {
        continue;
      }
      try {
        await this.spaceSafesService.addSafes({
          spaceId: args.spaceId,
          actorUserId: args.creatorId,
          payload: newSafes,
          addressBookItems: args.addressBookItems.filter(
            (item) => item.address.toLowerCase() === address,
          ),
        });
      } catch (error) {
        this.skipOrRethrow(error, {
          isSkippable: this.isRejectedSafe(error),
          what: `a Safe on ${newSafes.length} chain(s)`,
          spaceId: args.spaceId,
        });
      }
    }

    await this.addUnmatchedContacts({
      ...args,
      safeAddresses: new Set(Object.keys(safesByAddress)),
    });
  }

  private async withoutHeldSafes(
    spaceId: Space['id'],
    safes: Array<SpaceSetupSafe>,
  ): Promise<Array<SpaceSetupSafe>> {
    const held = await Promise.all(
      safes.map((safe) =>
        this.spaceSafesRepository.existsInSpace({ spaceId, ...safe }),
      ),
    );
    return safes.filter((_, index) => !held[index]);
  }

  /** Contacts for addresses that are not among the setup's Safes. */
  private async addUnmatchedContacts(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    addressBookItems: Array<AddressBookItem>;
    safeAddresses: Set<string>;
  }): Promise<void> {
    const contacts = args.addressBookItems.filter(
      (item) => !args.safeAddresses.has(item.address.toLowerCase()),
    );
    if (contacts.length === 0) {
      return;
    }
    try {
      await this.addressBookItemsRepository.upsertMany({
        userId: args.creatorId,
        spaceId: args.spaceId,
        addressBookItems: contacts,
      });
    } catch (error) {
      // The address book's own limit, the one rejection it answers with.
      this.skipOrRethrow(error, {
        isSkippable: error instanceof BadRequestException,
        what: `${contacts.length} contact(s)`,
        spaceId: args.spaceId,
      });
    }
  }

  /** One call per invite, so an invitee who cannot be invited skips only themselves. */
  private async inviteMembers(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    invites: Array<InviteUserInput>;
  }): Promise<void> {
    for (const invite of args.invites) {
      try {
        await this.membersService.inviteAs({
          spaceId: args.spaceId,
          actorUserId: args.creatorId,
          users: [invite],
        });
      } catch (error) {
        // Already a member, or already invited.
        this.skipOrRethrow(error, {
          isSkippable: error instanceof UniqueConstraintError,
          what: `a ${invite.type} invite`,
          spaceId: args.spaceId,
        });
      }
    }
  }

  /** Checked again: the survey can have changed since the setup was stored. */
  private async saveSurvey(args: {
    spaceId: Space['id'];
    creatorId: User['id'];
    survey: SpaceSetupSurvey;
  }): Promise<void> {
    try {
      const answer = await validateSurveyAnswer(
        this.surveysRepository,
        args.survey,
      );
      await this.surveysRepository.upsertResponse({
        spaceId: args.spaceId,
        surveyId: answer.survey.id,
        answeredByUserId: args.creatorId,
        selections: answer.selections,
      });
    } catch (error) {
      // The survey is no longer active, or the answer no longer fits it.
      this.skipOrRethrow(error, {
        isSkippable:
          error instanceof NotFoundException ||
          error instanceof InvalidSurveySelectionsError,
        what: `the "${args.survey.slug}" survey answer`,
        spaceId: args.spaceId,
      });
    }
  }

  /**
   * A Safe the plan has no seat for, one that is in the Workspace already,
   * or a contact over the address book's limit.
   */
  private isRejectedSafe(error: unknown): boolean {
    return (
      error instanceof QuotaExceededError ||
      error instanceof UniqueConstraintError ||
      error instanceof BadRequestException
    );
  }

  private skipOrRethrow(
    error: unknown,
    args: { isSkippable: boolean; what: string; spaceId: Space['id'] },
  ): void {
    if (!args.isSkippable) {
      throw error;
    }
    this.loggingService.warn(
      `Setup of space ${args.spaceId}: skipped ${args.what}: ${asError(error).message}`,
    );
  }
}
