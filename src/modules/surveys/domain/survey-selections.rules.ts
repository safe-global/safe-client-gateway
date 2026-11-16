// SPDX-License-Identifier: FSL-1.1-MIT

import type { SurveyPage } from '#/modules/surveys/domain/entities/survey.entity';
import type { SurveyResponseSelections } from '#/modules/surveys/domain/entities/survey-response.entity';
import { InvalidSurveySelectionsError } from '#/modules/surveys/domain/errors/invalid-survey-selections.error';

/**
 * Validates submitted selections against a survey's pages: every page must be
 * answered, no unknown page or option key is allowed, and a single-select
 * page takes one option.
 *
 * @returns the selections with repeated option keys removed.
 * @throws {InvalidSurveySelectionsError} when the selections do not fit the survey.
 */
export function validateSurveySelections(args: {
  pages: Array<SurveyPage>;
  submitted: SurveyResponseSelections;
}): SurveyResponseSelections {
  const pagesById = new Map(args.pages.map((page) => [page.id, page]));
  assertPageIdSetMatches({ expected: pagesById, submitted: args.submitted });

  const result: SurveyResponseSelections = {};
  for (const [pageId, submittedKeys] of Object.entries(args.submitted)) {
    const page = pagesById.get(pageId);
    // Unreachable: assertPageIdSetMatches already verified the set equality.
    if (!page) {
      continue;
    }
    result[pageId] = validatePageSelections(page, submittedKeys);
  }
  return result;
}

function assertPageIdSetMatches(args: {
  expected: Map<string, SurveyPage>;
  submitted: SurveyResponseSelections;
}): void {
  const submittedIds = new Set(Object.keys(args.submitted));

  const missing = [...args.expected.keys()].filter(
    (id) => !submittedIds.has(id),
  );
  if (missing.length > 0) {
    throw new InvalidSurveySelectionsError(
      `Missing answers for page(s): ${missing.join(', ')}`,
    );
  }

  const unknown = [...submittedIds].filter((id) => !args.expected.has(id));
  if (unknown.length > 0) {
    throw new InvalidSurveySelectionsError(
      `Unknown page id(s): ${unknown.join(', ')}`,
    );
  }
}

function validatePageSelections(
  page: SurveyPage,
  submittedKeys: Array<string>,
): Array<string> {
  const validKeys = new Set(page.options.map((option) => option.key));
  const deduped = Array.from(new Set(submittedKeys));

  const unknown = deduped.filter((key) => !validKeys.has(key));
  if (unknown.length > 0) {
    throw new InvalidSurveySelectionsError(
      `Unknown selection key(s) on page "${page.id}": ${unknown.join(', ')}`,
    );
  }
  if (!page.multiSelect && deduped.length > 1) {
    throw new InvalidSurveySelectionsError(
      `Page "${page.id}" is single-select but received ${deduped.length} selections`,
    );
  }
  return deduped;
}
