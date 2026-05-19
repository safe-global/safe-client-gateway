// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { Survey } from '@/modules/surveys/domain/entities/survey.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export const SubmitSurveyResponseDtoSchema = z.object({
  selections: z.array(z.string().min(1).max(64)).min(1).max(64),
});

export class SubmitSurveyResponseDto
  implements z.infer<typeof SubmitSurveyResponseDtoSchema>
{
  @ApiProperty({ type: String, isArray: true })
  selections!: Array<string>;
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

  @ApiProperty({ type: String, isArray: true })
  selections!: Array<string>;

  @ApiProperty()
  submittedAt!: Date;

  @ApiProperty({ type: Number, nullable: true })
  answeredByUserId!: User['id'] | null;
}
