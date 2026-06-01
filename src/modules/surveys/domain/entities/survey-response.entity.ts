// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import { SurveySchema } from '@/modules/surveys/domain/entities/survey.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';

// selections is a map from page id → selected option keys for that page.
// Keys are non-empty arrays (cannot submit an empty page), and the map
// itself must have at least one entry (cannot submit an empty body).
export const SurveyResponseSelectionsSchema = z
  .record(
    z.string().min(1).max(64),
    z.array(z.string().min(1).max(64)).min(1).max(64),
  )
  .refine((rec) => Object.keys(rec).length > 0, {
    message: 'selections must contain at least one page',
  });
export type SurveyResponseSelections = z.infer<
  typeof SurveyResponseSelectionsSchema
>;

export const SurveyResponseSchema = z.object({
  id: z.number().int(),
  space: z.lazy(() => SpaceSchema),
  survey: z.lazy(() => SurveySchema),
  answeredBy: z.lazy(() => UserSchema).nullable(),
  selections: SurveyResponseSelectionsSchema,
  submittedAt: z.date(),
  updatedAt: z.date(),
});
export type SurveyResponse = z.infer<typeof SurveyResponseSchema>;
