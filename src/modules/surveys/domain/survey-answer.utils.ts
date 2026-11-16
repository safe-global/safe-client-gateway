// SPDX-License-Identifier: FSL-1.1-MIT
import type { Survey } from '#/modules/surveys/domain/entities/survey.entity';
import type { SurveyResponseSelections } from '#/modules/surveys/domain/entities/survey-response.entity';
import { validateSurveySelections } from '#/modules/surveys/domain/survey-selections.rules';
import type { ISurveysRepository } from '#/modules/surveys/domain/surveys.repository.interface';

/**
 * Checks an answer against the survey active for its slug.
 *
 * @returns the active survey and the selections with repeated keys removed.
 * @throws {NotFoundException} when no survey is active for the slug.
 * @throws {InvalidSurveySelectionsError} when the selections do not fit it.
 */
export async function validateSurveyAnswer(
  surveysRepository: ISurveysRepository,
  answer: { slug: Survey['slug']; selections: SurveyResponseSelections },
): Promise<{ survey: Survey; selections: SurveyResponseSelections }> {
  const survey = await surveysRepository.findActiveBySlugOrFail(answer.slug);
  return {
    survey,
    selections: validateSurveySelections({
      pages: survey.surveyContent.pages,
      submitted: answer.selections,
    }),
  };
}
