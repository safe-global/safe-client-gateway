// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { oidcAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { surveyBuilder } from '@/modules/surveys/datasources/entities/__tests__/survey.entity.db.builder';
import type {
  Survey,
  SurveyPage,
} from '@/modules/surveys/domain/entities/survey.entity';
import type {
  ISurveysRepository,
  UpsertedSurveyResponse,
} from '@/modules/surveys/domain/surveys.repository.interface';
import { SurveysService } from '@/modules/surveys/routes/surveys.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

const surveysRepositoryMock = {
  findActiveBySlug: jest.fn(),
  findActiveBySlugOrFail: jest.fn(),
  findResponse: jest.fn(),
  upsertResponse: jest.fn(),
} as jest.MockedObjectDeep<ISurveysRepository>;

const membersRepositoryMock = {
  findOne: jest.fn(),
} as unknown as jest.MockedObjectDeep<IMembersRepository>;

const spacesRepositoryMock = {
  findIdByUuid: jest.fn(),
  findIdByIdOrUuid: jest.fn(),
} as unknown as jest.MockedObjectDeep<ISpacesRepository>;

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
    jest.resetAllMocks();
    service = new SurveysService(
      surveysRepositoryMock,
      membersRepositoryMock,
      spacesRepositoryMock,
    );
    userId = faker.number.int({ min: 1, max: 1_000_000 });
    spaceId = faker.number.int({ min: 1, max: 1_000_000 });
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

    it('rejects a missing required page id with 400', async () => {
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
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(surveysRepositoryMock.upsertResponse).not.toHaveBeenCalled();
    });

    it('rejects an unknown page id with 400', async () => {
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
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(surveysRepositoryMock.upsertResponse).not.toHaveBeenCalled();
    });

    it('rejects unknown selection keys within a page with 400', async () => {
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
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects more than one selection on a single-select page with 400', async () => {
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
      ).rejects.toBeInstanceOf(BadRequestException);
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
