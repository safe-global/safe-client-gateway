import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommonStatus } from '../analysis-result.entity';
import { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { AnalysisResultDto } from './analysis-result.dto';
import { SingleRecipientAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';

/**
 * DTO for recipient interaction analysis result.
 */
export class SingleRecipientAnalysisResultDto extends AnalysisResultDto<
  RecipientStatus | CommonStatus
> {
  @ApiProperty({
    description: 'Recipient interaction status code',
    enum: [...RecipientStatus, ...CommonStatus],
    example: 'NEW_RECIPIENT',
  })
  declare type: RecipientStatus | CommonStatus;
}

/**
 * DTO for single recipient analysis response.
 *
 * This DTO is used by the analyzeRecipient endpoint which only returns
 * recipient interaction and activity statuses (not bridge analysis).
 */
export class SingleRecipientAnalysisDto
  implements SingleRecipientAnalysisResponse
{
  @ApiProperty({
    description:
      'Analysis results related to recipient interaction history. ' +
      'Shows whether this is a new or recurring recipient.',
    type: [SingleRecipientAnalysisResultDto],
    example: [
      {
        severity: 'INFO',
        type: 'NEW_RECIPIENT',
        title: 'New recipient',
        description:
          'This is the first time you are interacting with this recipient.',
      },
    ],
  })
  RECIPIENT_INTERACTION!: Array<SingleRecipientAnalysisResultDto>;

  @ApiPropertyOptional({
    description:
      'Analysis results related to recipient activity. ' +
      'Shows whether this is a low activity recipient. ' +
      '(Available only for Safes)',
    type: [SingleRecipientAnalysisResultDto],
    example: [
      {
        severity: 'WARN',
        type: 'LOW_ACTIVITY',
        title: 'Low activity recipient',
        description: 'This address has few transactions.',
      },
    ],
  })
  RECIPIENT_ACTIVITY?: Array<SingleRecipientAnalysisResultDto>;

  @ApiProperty({
    description: 'Indicates whether the analyzed recipient address is a Safe.',
    example: false,
  })
  isSafe!: boolean;
}
