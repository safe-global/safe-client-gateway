// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { SurveyResponse } from '@/modules/surveys/domain/entities/survey-response.entity';
import type {
  Survey,
  SurveyOption,
} from '@/modules/surveys/domain/entities/survey.entity';
import { ISurveysRepository } from '@/modules/surveys/domain/surveys.repository.interface';
import type {
  SpaceSurveyResponseDto,
  SurveyDto,
  SurveyStateDto,
} from '@/modules/surveys/routes/entities/survey-state.dto.entity';
import {
  type SubmitSurveyResponseDto,
  SurveyResponseResultDto,
} from '@/modules/surveys/routes/entities/submit-survey-response.dto.entity';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

@Injectable()
export class SurveysService {
  constructor(
    @Inject(ISurveysRepository)
    private readonly surveysRepository: ISurveysRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {}

  public async getState(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    slug: Survey['slug'];
  }): Promise<SurveyStateDto> {
    await this.assertActiveAdmin({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });

    const survey = await this.findActiveSurveyOrFail(args.slug);
    const response = await this.surveysRepository.findResponse({
      spaceId: args.spaceId,
      surveyId: survey.id,
    });

    return {
      survey: this.toSurveyDto(survey),
      spaceResponse: response ? this.toSpaceResponseDto(response) : null,
    };
  }

  public async submitResponse(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
    slug: Survey['slug'];
    body: SubmitSurveyResponseDto;
  }): Promise<SurveyResponseResultDto> {
    const userId = await this.assertActiveAdmin({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });

    const survey = await this.findActiveSurveyOrFail(args.slug);

    const validKeys = new Set(
      survey.surveyContent.options.map((o: SurveyOption) => o.key),
    );
    const deduped = Array.from(new Set(args.body.selections));
    const unknown = deduped.filter((k) => !validKeys.has(k));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown selection keys: ${unknown.join(', ')}`,
      );
    }

    const response = await this.surveysRepository.upsertResponse({
      spaceId: args.spaceId,
      surveyId: survey.id,
      answeredByUserId: userId,
      selections: deduped,
    });

    return {
      id: response.id,
      spaceId: response.space.id,
      surveySlug: survey.slug,
      surveyVersion: survey.version,
      selections: response.selections,
      submittedAt: response.submittedAt,
      answeredByUserId: response.answeredBy?.id ?? null,
    };
  }

  private async assertActiveAdmin(args: {
    authPayload: AuthPayload;
    spaceId: Space['id'];
  }): Promise<number> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    const member = await this.membersRepository.findOne({
      user: { id: userId },
      space: { id: args.spaceId },
      status: 'ACTIVE',
      role: 'ADMIN',
    });
    if (!member) {
      throw new ForbiddenException(
        'User is not an active admin of this space.',
      );
    }
    return userId;
  }

  private async findActiveSurveyOrFail(
    slug: Survey['slug'],
  ): Promise<Survey> {
    const survey = await this.surveysRepository.findActiveBySlug(slug);
    if (!survey) {
      throw new NotFoundException(`No active survey for slug "${slug}".`);
    }
    return survey;
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

  private toSpaceResponseDto(
    response: SurveyResponse,
  ): SpaceSurveyResponseDto {
    return {
      surveyVersion: response.survey.version,
      selections: response.selections,
      submittedAt: response.submittedAt,
      answeredByUserId: response.answeredBy?.id ?? null,
    };
  }
}
