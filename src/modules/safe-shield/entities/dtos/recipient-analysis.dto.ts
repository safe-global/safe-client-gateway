import { ApiProperty } from '@nestjs/swagger';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { Severity } from '../severity.entity';
import type {
  AnalysisResult,
  AnalysisStatus,
  RecipientAnalysisResult,
} from '../analysis-result.entity';
import type { GroupedAnalysisResults } from '../analysis-responses.entity';
import { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';

/**
 * Generic DTO for a single analysis result.
 *
 * @template T - The specific status type (extends AnalysisStatus)
 */
export class AnalysisResultDto<T extends AnalysisStatus>
  implements AnalysisResult<T>
{
  @ApiProperty({
    description: 'Severity level indicating the importance and risk',
    enum: getStringEnumKeys(Severity),
    example: 'INFO',
  })
  severity!: keyof typeof Severity;

  @ApiProperty({
    description: 'Specific status code identifying the type of finding',
    example: 'NEW_RECIPIENT',
  })
  type!: T;

  @ApiProperty({
    description: 'User-facing title of the finding',
    example: 'New recipient',
  })
  title!: string;

  @ApiProperty({
    description:
      'Detailed description explaining the finding and its implications',
    example: 'This is the first time you are interacting with this recipient',
  })
  description!: string;
}

/**
 * DTO for recipient interaction analysis result.
 */
export class RecipientInteractionResultDto extends AnalysisResultDto<RecipientStatus> {
  @ApiProperty({
    description: 'Recipient interaction status code',
    enum: RecipientStatus,
    example: 'NEW_RECIPIENT',
  })
  type!: RecipientStatus;
}

/**
 * DTO for bridge analysis result.
 */
export class BridgeResultDto extends AnalysisResultDto<BridgeStatus> {
  @ApiProperty({
    description: 'Bridge compatibility status code',
    enum: BridgeStatus,
    example: 'MISSING_OWNERSHIP',
  })
  type!: BridgeStatus;
}

/**
 * DTO for single recipient analysis response.
 *
 * This DTO is used by the analyzeRecipient endpoint which only returns
 * recipient interaction status (not bridge analysis).
 */
export class RecipientInteractionAnalysisDto {
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

/**
 * DTO for full recipient analysis response.
 *
 * This DTO mirrors GroupedAnalysisResults<RecipientAnalysisResult> for Swagger documentation.
 * Results are grouped by status group and sorted by severity (CRITICAL first).
 * Used by endpoints that return both recipient interaction and bridge analysis.
 */
export class RecipientAnalysisDto
  implements GroupedAnalysisResults<RecipientAnalysisResult>
{
  @ApiProperty({
    description:
      'Analysis results related to recipient interaction history. ' +
      'Shows whether this is a new or recurring recipient.',
    type: [RecipientInteractionResultDto],
    required: false,
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
  RECIPIENT_INTERACTION?: Array<RecipientInteractionResultDto>;

  @ApiProperty({
    description:
      'Analysis results for cross-chain bridge operations. ' +
      'Identifies compatibility issues, ownership problems, or unsupported networks.',
    type: [BridgeResultDto],
    required: false,
    example: [
      {
        severity: 'WARN',
        type: 'MISSING_OWNERSHIP',
        title: 'No ownership on target chain',
        description: 'You do not have ownership of a Safe on the target chain',
      },
    ],
  })
  BRIDGE?: Array<BridgeResultDto>;
}
