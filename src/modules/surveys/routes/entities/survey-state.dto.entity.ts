// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  Survey,
  SurveyContent,
  SurveyOption,
  SurveyPage,
} from '@/modules/surveys/domain/entities/survey.entity';
import type { SurveyResponseSelections } from '@/modules/surveys/domain/entities/survey-response.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

class SurveyOptionDto implements SurveyOption {
  @ApiProperty({ type: String })
  key!: SurveyOption['key'];

  @ApiProperty({ type: String })
  label!: SurveyOption['label'];

  @ApiPropertyOptional({ type: String })
  description?: SurveyOption['description'];

  @ApiPropertyOptional({ type: String })
  icon?: SurveyOption['icon'];
}

class SurveyPageDto implements SurveyPage {
  @ApiProperty({ type: String })
  id!: SurveyPage['id'];

  @ApiProperty({ type: String })
  title!: SurveyPage['title'];

  @ApiProperty({ type: String, nullable: true })
  subtitle!: SurveyPage['subtitle'];

  @ApiProperty({ type: Boolean })
  multiSelect!: SurveyPage['multiSelect'];

  @ApiProperty({ type: SurveyOptionDto, isArray: true })
  options!: Array<SurveyOptionDto>;
}

class SurveyContentDto implements SurveyContent {
  @ApiProperty({ type: SurveyPageDto, isArray: true })
  pages!: Array<SurveyPageDto>;
}

export class SurveyDto
  implements Pick<Survey, 'id' | 'slug' | 'version' | 'title' | 'subtitle'>
{
  @ApiProperty({ type: Number })
  id!: Survey['id'];

  @ApiProperty({ type: String })
  slug!: Survey['slug'];

  @ApiProperty({ type: Number })
  version!: Survey['version'];

  @ApiProperty({ type: String })
  title!: Survey['title'];

  @ApiProperty({ type: String, nullable: true })
  subtitle!: Survey['subtitle'];

  @ApiProperty({ type: SurveyContentDto })
  surveyContent!: SurveyContentDto;
}

export class SpaceSurveyResponseDto {
  @ApiProperty({ type: Number })
  surveyVersion!: Survey['version'];

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Map from page id → selected option keys',
  })
  selections!: SurveyResponseSelections;

  @ApiProperty()
  submittedAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: Number, nullable: true })
  answeredByUserId!: User['id'] | null;
}

export class SurveyStateDto {
  @ApiProperty({ type: SurveyDto })
  survey!: SurveyDto;

  @ApiProperty({ type: SpaceSurveyResponseDto, nullable: true })
  spaceResponse!: SpaceSurveyResponseDto | null;
}
