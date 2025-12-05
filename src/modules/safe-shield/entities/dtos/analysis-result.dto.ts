import { ApiProperty } from '@nestjs/swagger';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { Severity } from '../severity.entity';
import {
  type AnalysisResult,
  type AnalysisStatus,
} from '../analysis-result.entity';

/**
 * Generic DTO for a single analysis result.
 *
 * @template T - The specific status type (extends AnalysisStatus)
 */
export class AnalysisResultDto<
  T extends AnalysisStatus,
> implements AnalysisResult<T> {
  @ApiProperty({
    description: 'Severity level indicating the importance and risk',
    enum: getStringEnumKeys(Severity),
  })
  severity!: keyof typeof Severity;

  @ApiProperty({
    description: 'Specific status code identifying the type of finding',
  })
  type!: T;

  @ApiProperty({
    description: 'User-facing title of the finding',
  })
  title!: string;

  @ApiProperty({
    description:
      'Detailed description explaining the finding and its implications',
  })
  description!: string;
}
