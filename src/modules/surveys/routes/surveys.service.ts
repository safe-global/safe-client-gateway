// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
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
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
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
    const userId = await this.assertActiveAdmin({
      authPayload: args.authPayload,
      spaceId: args.spaceId,
    });

    const survey = await this.surveysRepository.findActiveBySlugOrFail(
      args.slug,
    );

    const validatedSelections = this.validateSelections({
      pages: survey.surveyContent.pages,
      submitted: args.body.selections,
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

  /**
   * Validates the submitted selections against the active survey's pages.
   * Returns a normalised, deduped selections map.
   */
  private validateSelections(args: {
    pages: Array<SurveyPage>;
    submitted: SurveyResponseSelections;
  }): SurveyResponseSelections {
    const pagesById = new Map(args.pages.map((p) => [p.id, p]));
    this.assertPageIdSetMatches({
      expected: pagesById,
      submitted: args.submitted,
    });

    const result: SurveyResponseSelections = {};
    for (const [pageId, submittedKeys] of Object.entries(args.submitted)) {
      const page = pagesById.get(pageId);
      // Unreachable: assertPageIdSetMatches already verified the set equality.
      if (!page) continue;
      result[pageId] = this.validatePageSelections(page, submittedKeys);
    }
    return result;
  }

  /**
   * Verifies that the submitted page ids and the survey's page ids are the
   * same set — every survey page must be answered, and no unknown page ids
   * are allowed.
   */
  private assertPageIdSetMatches(args: {
    expected: Map<string, SurveyPage>;
    submitted: SurveyResponseSelections;
  }): void {
    const submittedIds = new Set(Object.keys(args.submitted));

    const missing = [...args.expected.keys()].filter(
      (id) => !submittedIds.has(id),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing answers for page(s): ${missing.join(', ')}`,
      );
    }

    const unknown = [...submittedIds].filter((id) => !args.expected.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown page id(s): ${unknown.join(', ')}`,
      );
    }
  }

  /**
   * Validates a single page's selections against its option keys, applies
   * the multi/single-select constraint, and returns the deduped result.
   */
  private validatePageSelections(
    page: SurveyPage,
    submittedKeys: Array<string>,
  ): Array<string> {
    const validKeys = new Set(page.options.map((o) => o.key));
    const deduped = Array.from(new Set(submittedKeys));

    const unknown = deduped.filter((k) => !validKeys.has(k));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown selection key(s) on page "${page.id}": ${unknown.join(', ')}`,
      );
    }
    if (!page.multiSelect && deduped.length > 1) {
      throw new BadRequestException(
        `Page "${page.id}" is single-select but received ${deduped.length} selections`,
      );
    }
    return deduped;
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
        'User is not an active admin of this workspace.',
      );
    }
    return userId;
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
