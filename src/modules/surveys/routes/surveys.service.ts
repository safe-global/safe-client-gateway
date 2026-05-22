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
import type {
  Survey,
  SurveyPage,
} from '@/modules/surveys/domain/entities/survey.entity';
import type {
  SurveyResponse,
  SurveyResponseSelections,
} from '@/modules/surveys/domain/entities/survey-response.entity';
import { ISurveysRepository } from '@/modules/surveys/domain/surveys.repository.interface';
import type {
  SubmitSurveyResponseDto,
  SurveyResponseResultDto,
} from '@/modules/surveys/routes/entities/submit-survey-response.dto.entity';
import type {
  SpaceSurveyResponseDto,
  SurveyDto,
  SurveyStateDto,
} from '@/modules/surveys/routes/entities/survey-state.dto.entity';
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

    const validatedSelections = this.validateSelections({
      pages: survey.surveyContent.pages,
      submitted: args.body.selections,
    });

    const response = await this.surveysRepository.upsertResponse({
      spaceId: args.spaceId,
      surveyId: survey.id,
      answeredByUserId: userId,
      selections: validatedSelections,
    });

    return {
      id: response.id,
      spaceId: response.space.id,
      surveySlug: survey.slug,
      surveyVersion: survey.version,
      selections: response.selections,
      submittedAt: response.submittedAt,
      updatedAt: response.updatedAt,
      answeredByUserId: response.answeredBy?.id ?? null,
    };
  }

  /**
   * Validates the submitted selections against the active survey's pages.
   * - Every page in the survey must be present as a key.
   * - No unknown page ids allowed.
   * - Each page's selections must be a subset of that page's option keys.
   * - Single-select pages may only have 1 selection.
   * Returns a normalised, deduped selections map.
   */
  private validateSelections(args: {
    pages: Array<SurveyPage>;
    submitted: SurveyResponseSelections;
  }): SurveyResponseSelections {
    const pagesById = new Map(args.pages.map((p) => [p.id, p]));
    const requiredIds = new Set(args.pages.map((p) => p.id));
    const submittedIds = new Set(Object.keys(args.submitted));

    const missing = [...requiredIds].filter((id) => !submittedIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing answers for page(s): ${missing.join(', ')}`,
      );
    }

    const unknownPages = [...submittedIds].filter((id) => !requiredIds.has(id));
    if (unknownPages.length > 0) {
      throw new BadRequestException(
        `Unknown page id(s): ${unknownPages.join(', ')}`,
      );
    }

    const result: SurveyResponseSelections = {};
    for (const [pageId, submittedKeys] of Object.entries(args.submitted)) {
      const page = pagesById.get(pageId);
      if (!page) continue; // unreachable after the check above
      const validKeys = new Set(page.options.map((o) => o.key));
      const deduped = Array.from(new Set(submittedKeys));
      const unknown = deduped.filter((k) => !validKeys.has(k));
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Unknown selection key(s) on page "${pageId}": ${unknown.join(', ')}`,
        );
      }
      if (!page.multiSelect && deduped.length > 1) {
        throw new BadRequestException(
          `Page "${pageId}" is single-select but received ${deduped.length} selections`,
        );
      }
      result[pageId] = deduped;
    }
    return result;
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

  private async findActiveSurveyOrFail(slug: Survey['slug']): Promise<Survey> {
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
