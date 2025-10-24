import { ApiProperty } from '@nestjs/swagger';
import { CommonStatus } from '../analysis-result.entity';
import { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { AnalysisResultDto } from './analysis-result.dto';
import { RecipientInteractionAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';

/**
 * DTO for recipient interaction analysis result.
 */
export class RecipientInteractionResultDto extends AnalysisResultDto<
  RecipientStatus | CommonStatus
> {
  @ApiProperty({
    description: 'Recipient interaction status code',
    enum: [...RecipientStatus, ...CommonStatus],
    example: 'NEW_RECIPIENT',
  })
  type!: RecipientStatus | CommonStatus;
}

/**
 * DTO for single recipient analysis response.
 *
 * This DTO is used by the analyzeRecipient endpoint which only returns
 * recipient interaction status (not bridge analysis).
 */
export class RecipientInteractionAnalysisDto
  implements RecipientInteractionAnalysisResponse
{
  @ApiProperty({
    description:
      'Analysis results related to recipient interaction history. ' +
      'Shows whether this is a new or recurring recipient.',
    type: [RecipientInteractionResultDto],
    example: [
      {
        severity: 'INFO',
        type: 'NEW_RECIPIENT',
        title: 'New recipient',
        description:
          'This is the first time you are interacting with this recipient',
      },
    ],
  })
  RECIPIENT_INTERACTION!: Array<RecipientInteractionResultDto>;
}
