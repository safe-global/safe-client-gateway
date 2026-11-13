// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { oidcAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import { surveyBuilder } from '#/modules/surveys/datasources/entities/__tests__/survey.entity.db.builder';
import type {
  Survey,
  SurveyPage,
} from '#/modules/surveys/domain/entities/survey.entity';
import { InvalidSurveySelectionsError } from '#/modules/surveys/domain/errors/invalid-survey-selections.error';
import type {
  ISurveysRepository,
  UpsertedSurveyResponse,
} from '#/modules/surveys/domain/surveys.repository.interface';
import { SurveysService } from '#/modules/surveys/routes/surveys.service';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { fakeUuid } from '#/validation/entities/schemas/__tests__/uuid.builder';

const surveysRepositoryMock = {
  findActiveBySlug: vi.fn(),
  findActiveBySlugOrFail: vi.fn(),
  findResponse: vi.fn(),
  upsertResponse: vi.fn(),
} as MockedObject<ISurveysRepository>;

const membersRepositoryMock = {
  findOne: vi.fn(),
} as unknown as MockedObject<IMembersRepository>;

const spacesRepositoryMock = {
  findUuidById: vi.fn(),
} as MockedObject<ISpacesRepository>;

function buildSurvey(pages: Array<SurveyPage>): Survey {
  return surveyBuilder()
    .with('slug', 'onboarding')
    .with('surveyContent', { pages })
    .build();
}

function buildUpsertedRow(): UpsertedSurveyResponse {
  return {
    id: 100,
    submittedAt: new Date('2026-05-01T10:00:00Z'),
    updatedAt: new Date('2026-05-01T10:00:00Z'),
  };
}

describe('SurveysService', () => {
  let service: SurveysService;
  let authPayload: AuthPayload;
  let spaceId: number;
  let userId: number;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SurveysService(
      surveysRepositoryMock,
      membersRepositoryMock,
      spacesRepositoryMock,
    );
    userId = faker.number.int({ min: 1, max: 1_000_000 });
    spaceId = faker.number.int({ min: 1, max: 1_000_000 });
    spacesRepositoryMock.findUuidById.mockResolvedValue(fakeUuid());
    authPayload = new AuthPayload(
      oidcAuthPayloadDtoBuilder().with('sub', String(userId)).build(),
    );
    // Default: caller is an active admin of the space.
    membersRepositoryMock.findOne.mockResolvedValue(
      memberBuilder().with('role', 'ADMIN').with('status', 'ACTIVE').build(),
    );
  });

  describe('admin gate', () => {
    it('throws ForbiddenException when caller is not an active admin', async () => {
      membersRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: { selections: { use_cases: ['hold_assets'] } },
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(
        surveysRepositoryMock.findActiveBySlugOrFail,
      ).not.toHaveBeenCalled();
      expect(surveysRepositoryMock.upsertResponse).not.toHaveBeenCalled();
    });
  });

  describe('survey lookup', () => {
    it('propagates NotFoundException when slug has no active survey', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockRejectedValue(
        new NotFoundException('No active survey for slug "onboarding".'),
      );

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: { selections: { use_cases: ['hold_assets'] } },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getActiveSurvey', () => {
    it('returns the active survey without reading any membership', async () => {
      const survey = surveyBuilder().build();
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(survey);

      await expect(service.getActiveSurvey(survey.slug)).resolves.toEqual({
        id: survey.id,
        slug: survey.slug,
        version: survey.version,
        title: survey.title,
        subtitle: survey.subtitle,
        surveyContent: survey.surveyContent,
      });
      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the slug has no active survey', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockRejectedValue(
        new NotFoundException('No active survey for slug "onboarding".'),
      );

      await expect(
        service.getActiveSurvey(faker.lorem.slug()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('validateSelections (via submitResponse)', () => {
    const multiSelectPage: SurveyPage = {
      id: 'use_cases',
      title: 'How will you use Safe?',
      subtitle: null,
      multiSelect: true,
      options: [
        { key: 'run_payments', label: 'Run payments' },
        { key: 'hold_assets', label: 'Hold assets' },
        { key: 'earn_yield', label: 'Earn yield' },
      ],
    };

    const singleSelectPage: SurveyPage = {
      id: 'team_size',
      title: 'How big is your team?',
      subtitle: null,
      multiSelect: false,
      options: [
        { key: 'one_to_five', label: '1-5' },
        { key: 'six_to_twenty', label: '6-20' },
      ],
    };

    it('rejects a missing required page id', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(
        buildSurvey([multiSelectPage, singleSelectPage]),
      );

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: { selections: { use_cases: ['hold_assets'] } },
        }),
      ).rejects.toBeInstanceOf(InvalidSurveySelectionsError);
      expect(surveysRepositoryMock.upsertResponse).not.toHaveBeenCalled();
    });

    it('rejects an unknown page id', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(
        buildSurvey([multiSelectPage]),
      );

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: {
            selections: {
              use_cases: ['hold_assets'],
              made_up_page: ['x'],
            },
          },
        }),
      ).rejects.toBeInstanceOf(InvalidSurveySelectionsError);
      expect(surveysRepositoryMock.upsertResponse).not.toHaveBeenCalled();
    });

    it('rejects unknown selection keys within a page', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(
        buildSurvey([multiSelectPage]),
      );

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: {
            selections: { use_cases: ['hold_assets', 'totally_made_up'] },
          },
        }),
      ).rejects.toBeInstanceOf(InvalidSurveySelectionsError);
    });

    it('rejects more than one selection on a single-select page', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(
        buildSurvey([singleSelectPage]),
      );

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: {
            selections: { team_size: ['one_to_five', 'six_to_twenty'] },
          },
        }),
      ).rejects.toBeInstanceOf(InvalidSurveySelectionsError);
    });

    it('accepts exactly one selection on a single-select page', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(
        buildSurvey([singleSelectPage]),
      );
      surveysRepositoryMock.upsertResponse.mockResolvedValue(
        buildUpsertedRow(),
      );

      await expect(
        service.submitResponse({
          authPayload,
          spaceId,
          slug: 'onboarding',
          body: { selections: { team_size: ['one_to_five'] } },
        }),
      ).resolves.toMatchObject({
        selections: { team_size: ['one_to_five'] },
      });
    });

    it('dedupes repeated selection keys before persisting', async () => {
      surveysRepositoryMock.findActiveBySlugOrFail.mockResolvedValue(
        buildSurvey([multiSelectPage]),
      );
      surveysRepositoryMock.upsertResponse.mockResolvedValue(
        buildUpsertedRow(),
      );

      await service.submitResponse({
        authPayload,
        spaceId,
        slug: 'onboarding',
        body: {
          selections: {
            use_cases: ['hold_assets', 'hold_assets', 'run_payments'],
          },
        },
      });

      expect(surveysRepositoryMock.upsertResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          selections: { use_cases: ['hold_assets', 'run_payments'] },
        }),
      );
    });
  });
});
