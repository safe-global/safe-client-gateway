// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { SpaceSchema } from '@/modules/spaces/domain/entities/space.entity';
import { SurveySchema } from '@/modules/surveys/domain/entities/survey.entity';
import { UserSchema } from '@/modules/users/domain/entities/user.entity';

export const SurveyResponseSchema = z.object({
  id: z.number().int(),
  space: z.lazy(() => SpaceSchema),
  survey: z.lazy(() => SurveySchema),
  answeredBy: z.lazy(() => UserSchema).nullable(),
  selections: z.array(z.string().min(1).max(64)).min(1).max(64),
  submittedAt: z.date(),
  updatedAt: z.date(),
});
export type SurveyResponse = z.infer<typeof SurveyResponseSchema>;
