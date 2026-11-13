// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { UniqueConstraintError } from '#/datasources/errors/unique-constraint-error';
import type { ILoggingService } from '#/logging/logging.interface';
import { QuotaExceededError } from '#/modules/entitlements/domain/errors/quota-exceeded.error';
import type { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import {
  contactFor,
  spaceSetupBuilder,
  spaceSetupPayloadBuilder,
  spaceSetupSafeBuilder,
} from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import type { SpaceSetupPayload } from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { SETUP_APPLY_LEASE_SECONDS } from '#/modules/spaces/domain/setup/space-setup-claim.rules';
import type { ISpaceSetupsRepository } from '#/modules/spaces/domain/setup/space-setups.repository.interface';
import {
  emailInviteUserDtoBuilder,
  walletInviteUserDtoBuilder,
} from '#/modules/spaces/routes/members/entities/__tests__/invite-user.dto.builder';
import type { MembersService } from '#/modules/spaces/routes/members/members.service';
import type { SpaceSafesService } from '#/modules/spaces/routes/safes/space-safes.service';
import { SpaceSetupApplyService } from '#/modules/spaces/routes/setup/space-setup-apply.service';
import { surveyBuilder } from '#/modules/surveys/datasources/entities/__tests__/survey.entity.db.builder';
import type { SurveyPage } from '#/modules/surveys/domain/entities/survey.entity';
import type { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { userBuilder } from '#/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

describe('SpaceSetupApplyService', () => {
  let spaceSetupsRepository: MockedObject<ISpaceSetupsRepository>;
  let spaceSafesRepository: MockedObject<ISpaceSafesRepository>;
  let addressBookItemsRepository: MockedObject<IAddressBookItemsRepository>;
  let membersRepository: MockedObject<IMembersRepository>;
  let surveysRepository: MockedObject<ISurveysRepository>;
  let spaceSafesService: MockedObject<SpaceSafesService>;
  let membersService: MockedObject<MembersService>;
  let loggingService: MockedObject<ILoggingService>;
  let creatorId: number;
  let target: SpaceSetupApplyService;

  beforeEach(() => {
    spaceSetupsRepository = {
      claim: vi.fn(),
      markApplied: vi.fn(),
    } as MockedObject<ISpaceSetupsRepository>;
    spaceSafesRepository = {
      existsInSpace: vi.fn().mockResolvedValue(false),
    } as MockedObject<ISpaceSafesRepository>;
    addressBookItemsRepository = {
      upsertMany: vi.fn(),
    } as MockedObject<IAddressBookItemsRepository>;
    creatorId = faker.number.int({ min: 1, max: 1_000_000 });
    membersRepository = {
      find: vi
        .fn()
        .mockResolvedValue([
          memberBuilder()
            .with('user', userBuilder().with('id', creatorId).build())
            .with('invitedBy', null)
            .build(),
        ]),
    } as MockedObject<IMembersRepository>;
    surveysRepository = {
      findActiveBySlugOrFail: vi.fn(),
      upsertResponse: vi.fn(),
    } as MockedObject<ISurveysRepository>;
    spaceSafesService = {
      addSafes: vi.fn(),
    } as MockedObject<SpaceSafesService>;
    membersService = {
      inviteAs: vi.fn().mockResolvedValue([]),
    } as MockedObject<MembersService>;
    loggingService = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as MockedObject<ILoggingService>;

    target = new SpaceSetupApplyService(
      spaceSetupsRepository,
      spaceSafesRepository,
      addressBookItemsRepository,
      membersRepository,
      surveysRepository,
      spaceSafesService,
      membersService,
      loggingService,
    );
  });

  /** The setup a claim hands over, with `payload` overriding the default form. */
  function claimed(payload: Partial<SpaceSetupPayload>): number {
    const setup = spaceSetupBuilder()
      .with('status', 'APPLYING')
      .with('payload', { ...spaceSetupPayloadBuilder().build(), ...payload })
      .build();
    spaceSetupsRepository.claim.mockResolvedValue({
      ...setup,
      claimId: fakeUuid(),
    });
    return setup.spaceId;
  }

  function onePageSurvey(): { page: SurveyPage; optionKey: string } {
    const optionKey = faker.string.alpha(8);
    return {
      optionKey,
      page: {
        id: faker.string.alpha(8),
        title: faker.lorem.words(),
        subtitle: null,
        multiSelect: true,
        options: [{ key: optionKey, label: faker.lorem.word() }],
      },
    };
  }

  it('does nothing when there is no setup to claim', async () => {
    spaceSetupsRepository.claim.mockResolvedValue(null);

    await target.apply(faker.number.int({ min: 1 }));

    expect(spaceSafesService.addSafes).not.toHaveBeenCalled();
    expect(spaceSetupsRepository.markApplied).not.toHaveBeenCalled();
  });

  it('marks the setup applied under the claim it holds', async () => {
    const setup = { ...spaceSetupBuilder().build(), claimId: fakeUuid() };
    spaceSetupsRepository.claim.mockResolvedValue(setup);
    spaceSetupsRepository.markApplied.mockResolvedValue(true);

    await target.apply(setup.spaceId);

    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledExactlyOnceWith({
      spaceId: setup.spaceId,
      claimId: setup.claimId,
    });
    expect(loggingService.info).toHaveBeenCalledWith(
      `Applied the setup of space ${setup.spaceId}`,
    );
  });

  it('logs a lost claim when a later apply took the setup over', async () => {
    const spaceId = claimed({});
    spaceSetupsRepository.markApplied.mockResolvedValue(false);

    await target.apply(spaceId);

    expect(loggingService.info).toHaveBeenCalledWith(
      `Lost the claim on the setup of space ${spaceId} to a later apply`,
    );
  });

  it('claims with the configured lease', async () => {
    const spaceId = faker.number.int({ min: 1 });
    spaceSetupsRepository.claim.mockResolvedValue(null);

    await target.apply(spaceId);

    expect(spaceSetupsRepository.claim).toHaveBeenCalledWith({
      spaceId,
      leaseSeconds: SETUP_APPLY_LEASE_SECONDS,
    });
  });

  it('adds each Safe with its contact as the creator, then marks the setup applied', async () => {
    const safe = spaceSetupSafeBuilder().build();
    const contact = contactFor(safe);
    const spaceId = claimed({ safes: [safe], addressBookItems: [contact] });

    await target.apply(spaceId);

    expect(spaceSafesService.addSafes).toHaveBeenCalledWith({
      spaceId,
      actorUserId: creatorId,
      payload: [safe],
      addressBookItems: [contact],
    });
    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledWith({
      spaceId,
      claimId: expect.any(String),
    });
  });

  it('adds one Safe on two chains in one call', async () => {
    const safe = spaceSetupSafeBuilder().build();
    const otherChain = { ...safe, chainId: `${safe.chainId}1` };
    const spaceId = claimed({
      safes: [safe, otherChain],
      addressBookItems: [],
    });

    await target.apply(spaceId);

    expect(spaceSafesService.addSafes).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ payload: [safe, otherChain] }),
    );
  });

  it('stores the contact of a Safe the plan has no seat for', async () => {
    const safe = spaceSetupSafeBuilder().build();
    const contact = contactFor(safe);
    const spaceId = claimed({ safes: [safe], addressBookItems: [contact] });
    spaceSafesService.addSafes.mockRejectedValue(
      new QuotaExceededError({
        feature: 'safe_seats',
        quota: 1,
        used: 1,
        resetsAt: null,
      }),
    );

    await target.apply(spaceId);

    expect(addressBookItemsRepository.upsertMany).toHaveBeenCalledWith({
      userId: creatorId,
      spaceId,
      addressBookItems: [contact],
    });
  });

  it.each([
    [
      'a Safe the plan has no seat for',
      (): Error =>
        new QuotaExceededError({
          feature: 'safe_seats',
          quota: 1,
          used: 1,
          resetsAt: null,
        }),
    ],
    [
      'a Safe already in the Workspace',
      (): Error => new UniqueConstraintError(faker.lorem.sentence()),
    ],
  ])('skips %s and applies the rest', async (_label, rejection) => {
    const [rejected, accepted] = [
      spaceSetupSafeBuilder().build(),
      spaceSetupSafeBuilder().build(),
    ];
    const spaceId = claimed({
      safes: [rejected, accepted],
      addressBookItems: [],
    });
    spaceSafesService.addSafes.mockRejectedValueOnce(rejection());

    await target.apply(spaceId);

    expect(spaceSafesService.addSafes).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: [accepted] }),
    );
    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledWith({
      spaceId,
      claimId: expect.any(String),
    });
  });

  it('leaves the setup claimed when an unexpected failure stops it', async () => {
    const spaceId = claimed({ safes: [spaceSetupSafeBuilder().build()] });
    const failure = new Error('KMS unavailable');
    spaceSafesService.addSafes.mockRejectedValue(failure);

    await expect(target.apply(spaceId)).rejects.toBe(failure);
    expect(spaceSetupsRepository.markApplied).not.toHaveBeenCalled();
  });

  it('does not add a Safe the Workspace already holds', async () => {
    const spaceId = claimed({ safes: [spaceSetupSafeBuilder().build()] });
    spaceSafesRepository.existsInSpace.mockResolvedValue(true);

    await target.apply(spaceId);

    expect(spaceSafesService.addSafes).not.toHaveBeenCalled();
    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledWith({
      spaceId,
      claimId: expect.any(String),
    });
  });

  it('stores the contact of a Safe the Workspace already holds', async () => {
    const safe = spaceSetupSafeBuilder().build();
    const contact = contactFor(safe);
    const spaceId = claimed({ safes: [safe], addressBookItems: [contact] });
    spaceSafesRepository.existsInSpace.mockResolvedValue(true);

    await target.apply(spaceId);

    expect(addressBookItemsRepository.upsertMany).toHaveBeenCalledWith({
      userId: creatorId,
      spaceId,
      addressBookItems: [contact],
    });
  });

  it('stores contacts for addresses that are not among the Safes', async () => {
    const contact = contactFor(spaceSetupSafeBuilder().build());
    const spaceId = claimed({ safes: [], addressBookItems: [contact] });

    await target.apply(spaceId);

    expect(addressBookItemsRepository.upsertMany).toHaveBeenCalledWith({
      userId: creatorId,
      spaceId,
      addressBookItems: [contact],
    });
  });

  it('invites each member with the creator as the inviter', async () => {
    const invites = [
      walletInviteUserDtoBuilder().build(),
      emailInviteUserDtoBuilder().build(),
    ];
    const spaceId = claimed({ safes: [], addressBookItems: [], invites });

    await target.apply(spaceId);

    for (const invite of invites) {
      expect(membersService.inviteAs).toHaveBeenCalledWith({
        spaceId,
        actorUserId: creatorId,
        users: [invite],
        onPendingInvite: 'refuse',
      });
    }
  });

  it('skips an invitee who is already a member, and applies the rest', async () => {
    const invites = [
      walletInviteUserDtoBuilder().build(),
      walletInviteUserDtoBuilder().build(),
    ];
    const spaceId = claimed({ invites });
    membersService.inviteAs.mockRejectedValueOnce(
      new UniqueConstraintError(faker.lorem.sentence()),
    );

    await target.apply(spaceId);

    expect(membersService.inviteAs).toHaveBeenCalledTimes(2);
    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledWith({
      spaceId,
      claimId: expect.any(String),
    });
  });

  it('saves the survey answer, answered by the creator', async () => {
    const { page, optionKey } = onePageSurvey();
    const survey = surveyBuilder()
      .with('surveyContent', { pages: [page] })
      .build();
    const selections = { [page.id]: [optionKey] };
    const spaceId = claimed({ survey: { slug: survey.slug, selections } });
    surveysRepository.findActiveBySlugOrFail.mockResolvedValue(survey);

    await target.apply(spaceId);

    expect(surveysRepository.upsertResponse).toHaveBeenCalledWith({
      spaceId,
      surveyId: survey.id,
      answeredByUserId: creatorId,
      selections,
    });
  });

  it('skips a survey answer when the survey is no longer active', async () => {
    const spaceId = claimed({
      survey: { slug: faker.lorem.slug(), selections: { a: ['b'] } },
    });
    surveysRepository.findActiveBySlugOrFail.mockRejectedValue(
      new NotFoundException(),
    );

    await target.apply(spaceId);

    expect(surveysRepository.upsertResponse).not.toHaveBeenCalled();
    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledWith({
      spaceId,
      claimId: expect.any(String),
    });
  });

  it('skips a survey answer that no longer fits the active survey', async () => {
    const { page } = onePageSurvey();
    const survey = surveyBuilder()
      .with('surveyContent', { pages: [page] })
      .build();
    const spaceId = claimed({
      survey: { slug: survey.slug, selections: { [page.id]: ['unknown'] } },
    });
    surveysRepository.findActiveBySlugOrFail.mockResolvedValue(survey);

    await target.apply(spaceId);

    expect(surveysRepository.upsertResponse).not.toHaveBeenCalled();
    expect(spaceSetupsRepository.markApplied).toHaveBeenCalledWith({
      spaceId,
      claimId: expect.any(String),
    });
  });

  it('fails without marking the setup applied when the space has no creator', async () => {
    const spaceId = claimed({});
    membersRepository.find.mockResolvedValue([]);

    await expect(target.apply(spaceId)).rejects.toThrow(
      `Space ${spaceId} has no creator to apply its setup as`,
    );
    expect(spaceSetupsRepository.markApplied).not.toHaveBeenCalled();
  });
});
