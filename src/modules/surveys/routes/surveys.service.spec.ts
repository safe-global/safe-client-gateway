// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { oidcAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type {
  Survey,
  SurveyPage,
} from '@/modules/surveys/domain/entities/survey.entity';
import type { SurveyResponse } from '@/modules/surveys/domain/entities/survey-response.entity';
import type { ISurveysRepository } from '@/modules/surveys/domain/surveys.repository.interface';
import { SurveysService } from '@/modules/surveys/routes/surveys.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

const surveysRepositoryMock = {
  findActiveBySlug: jest.fn(),
  findResponse: jest.fn(),
  upsertResponse: jest.fn(),
} as jest.MockedObjectDeep<ISurveysRepository>;

const membersRepositoryMock = {
  findOne: jest.fn(),
} as unknown as jest.MockedObjectDeep<IMembersRepository>;

function buildSurvey(pages: Array<SurveyPage>): Survey {
  return {
    id: 1,
    slug: 'onboarding',
    version: 1,
    title: 'Space Onboarding Survey',
    subtitle: null,
    surveyContent: { pages },
    isActive: true,
    createdAt: new Date(),
  };
}

function buildResponseRow(args: {
  selections: SurveyResponse['selections'];
  surveyId: number;
  spaceId: number;
  answeredById: number | null;
}): SurveyResponse {
  return {
    id: 100,
    selections: args.selections,
    submittedAt: new Date(),
    updatedAt: new Date(),
    space: { id: args.spaceId } as SurveyResponse['space'],
    survey: { id: args.surveyId, version: 1 } as SurveyResponse['survey'],
    answeredBy:
      args.answeredById === null
        ? null
        : ({ id: args.answeredById } as SurveyResponse['answeredBy']),
  };
}

describe('SurveysService', () => {
  let service: SurveysService;
  let authPayload: AuthPayload;
  let spaceId: number;
  let userId: number;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SurveysService(surveysRepositoryMock, membersRepositoryMock);
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

      expect(surveysRepositoryMock.findActiveBySlug).not.toHaveBeenCalled();
      expect(surveysRepositoryMock.upsertResponse).not.toHaveBeenCalled();
    });
  });

  describe('survey lookup', () => {
    it('throws NotFoundException when slug has no active survey', async () => {
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(null);

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
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(
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
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(
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
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(
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
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(
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
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(
        buildSurvey([singleSelectPage]),
      );
      surveysRepositoryMock.upsertResponse.mockImplementation((args) =>
        Promise.resolve(
          buildResponseRow({
            selections: args.selections,
            surveyId: 1,
            spaceId,
            answeredById: userId,
          }),
        ),
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
      surveysRepositoryMock.findActiveBySlug.mockResolvedValue(
        buildSurvey([multiSelectPage]),
      );
      surveysRepositoryMock.upsertResponse.mockImplementation((args) =>
        Promise.resolve(
          buildResponseRow({
            selections: args.selections,
            surveyId: 1,
            spaceId,
            answeredById: userId,
          }),
        ),
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
