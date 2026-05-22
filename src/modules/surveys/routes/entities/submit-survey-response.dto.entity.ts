// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { Survey } from '@/modules/surveys/domain/entities/survey.entity';
import type { SurveyResponseSelections } from '@/modules/surveys/domain/entities/survey-response.entity';
import { SurveyResponseSelectionsSchema } from '@/modules/surveys/domain/entities/survey-response.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export const SubmitSurveyResponseDtoSchema = z.object({
  selections: SurveyResponseSelectionsSchema,
});

export class SubmitSurveyResponseDto
  implements z.infer<typeof SubmitSurveyResponseDtoSchema>
{
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Map from page id → selected option keys',
    example: { use_cases: ['run_payments', 'hold_assets'] },
  })
  selections!: SurveyResponseSelections;
}

export class SurveyResponseResultDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  spaceId!: Space['id'];

  @ApiProperty({ type: String })
  surveySlug!: Survey['slug'];

  @ApiProperty({ type: Number })
  surveyVersion!: Survey['version'];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  selections!: SurveyResponseSelections;

  @ApiProperty()
  submittedAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: Number, nullable: true })
  answeredByUserId!: User['id'] | null;
}
