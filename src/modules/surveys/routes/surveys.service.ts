// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { assertAdmin } from '#/modules/spaces/domain/space-assert.utils';
import { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import type { Survey } from '#/modules/surveys/domain/entities/survey.entity';
import type { SurveyResponse } from '#/modules/surveys/domain/entities/survey-response.entity';
import { validateSurveyAnswer } from '#/modules/surveys/domain/survey-answer.utils';
import { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';
import type {
  SubmitSurveyResponseDto,
  SurveyResponseResultDto,
} from '#/modules/surveys/routes/entities/submit-survey-response.dto.entity';
import type {
  SpaceSurveyResponseDto,
  SurveyDto,
  SurveyStateDto,
} from '#/modules/surveys/routes/entities/survey-state.dto.entity';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

@Injectable()
export class SurveysService {
  constructor(
    @Inject(ISurveysRepository)
    private readonly surveysRepository: ISurveysRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  public async getState(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    slug: Survey['slug'];
  }): Promise<SurveyStateDto> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    const survey = await this.surveysRepository.findActiveBySlugOrFail(
      args.slug,
    );
    const response = await this.surveysRepository.findResponse({
      spaceId: args.spaceId,
      surveyId: survey.id,
    });

    return {
      survey: this.toSurveyDto(survey),
      surveyResponse: response ? this.toSpaceResponseDto(response) : null,
    };
  }

  public async submitResponse(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    slug: Survey['slug'];
    body: SubmitSurveyResponseDto;
  }): Promise<SurveyResponseResultDto> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    const { survey, selections: validatedSelections } =
      await validateSurveyAnswer(this.surveysRepository, {
        slug: args.slug,
        selections: args.body.selections,
      });

    const [upserted, spaceUuid] = await Promise.all([
      this.surveysRepository.upsertResponse({
        spaceId: args.spaceId,
        surveyId: survey.id,
        answeredByUserId: userId,
        selections: validatedSelections,
      }),
      this.spacesRepository.findUuidById(args.spaceId),
    ]);

    return {
      id: upserted.id,
      spaceUuid,
      surveySlug: survey.slug,
      surveyVersion: survey.version,
      selections: validatedSelections,
      submittedAt: upserted.submittedAt,
      updatedAt: upserted.updatedAt,
      answeredByUserId: userId,
    };
  }

  private toSurveyDto(survey: Survey): SurveyDto {
    return {
      id: survey.id,
      slug: survey.slug,
      version: survey.version,
      title: survey.title,
      subtitle: survey.subtitle,
      surveyContent: survey.surveyContent,
    };
  }

  private toSpaceResponseDto(response: SurveyResponse): SpaceSurveyResponseDto {
    return {
      surveyVersion: response.survey.version,
      selections: response.selections,
      submittedAt: response.submittedAt,
      updatedAt: response.updatedAt,
      answeredByUserId: response.answeredBy?.id ?? null,
    };
  }
}
