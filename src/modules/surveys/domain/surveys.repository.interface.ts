// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { Survey } from '@/modules/surveys/domain/entities/survey.entity';
import type {
  SurveyResponse,
  SurveyResponseSelections,
} from '@/modules/surveys/domain/entities/survey-response.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export const ISurveysRepository = Symbol('ISurveysRepository');

export type UpsertedSurveyResponse = Pick<
  SurveyResponse,
  'id' | 'submittedAt' | 'updatedAt'
>;

export interface ISurveysRepository {
  findActiveBySlug(slug: Survey['slug']): Promise<Survey | null>;

  findActiveBySlugOrFail(slug: Survey['slug']): Promise<Survey>;

  findResponse(args: {
    spaceId: Space['id'];
    surveyId: Survey['id'];
  }): Promise<SurveyResponse | null>;

  upsertResponse(args: {
    spaceId: Space['id'];
    surveyId: Survey['id'];
    answeredByUserId: User['id'];
    selections: SurveyResponseSelections;
  }): Promise<UpsertedSurveyResponse>;
}
