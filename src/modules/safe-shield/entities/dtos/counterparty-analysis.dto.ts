import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  CommonStatus,
  type RecipientAnalysisResult,
  type UnofficialFallbackHandlerAnalysisResult,
  type ContractAnalysisResult,
} from '../analysis-result.entity';
import type {
  CounterpartyAnalysisResponse,
  GroupedAnalysisResults,
} from '@/modules/safe-shield/entities/analysis-responses.entity';
import { ContractStatus } from '@/modules/safe-shield/entities/contract-status.entity';
import { AnalysisResultDto } from './analysis-result.dto';
import { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';
import { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { type Address } from 'viem';
import {
  ContractStatusGroup,
  RecipientStatusGroup,
} from '@/modules/safe-shield/entities/status-group.entity';

/**
 * DTO for contract analysis result.
 */
export class ContractAnalysisResultDto extends AnalysisResultDto<
  ContractStatus | CommonStatus
> {
  @ApiProperty({
    description: 'Contract verification status code',
    enum: [...Object.values(ContractStatus), ...Object.values(CommonStatus)],
    example: 'VERIFIED',
  })
  declare type: ContractStatus | CommonStatus;
}

/**
 * DTO for fallback handler information.
 */
class FallbackHandlerInfoDto {
  @ApiProperty({
    description: 'Address of the fallback handler contract',
  })
  public readonly address!: Address;

  @ApiPropertyOptional({
    description: 'Name of the fallback handler contract',
  })
  public readonly name?: string;

  @ApiPropertyOptional({
    description: 'Logo URL for the fallback handler contract',
  })
  public readonly logoUrl?: string;
}

/**
 * DTO for unofficial fallback handler analysis result.
 * Includes additional fallback handler information.
 */
export class FallbackHandlerAnalysisResultDto
  extends ContractAnalysisResultDto
  implements UnofficialFallbackHandlerAnalysisResult
{
  @ApiProperty({
    description: 'Status code for unofficial fallback handler',
    enum: [ContractStatus.UNOFFICIAL_FALLBACK_HANDLER],
  })
  declare type: Extract<ContractStatus, 'UNOFFICIAL_FALLBACK_HANDLER'>;

  @ApiPropertyOptional({
    description: 'Information about the fallback handler',
    type: FallbackHandlerInfoDto,
  })
  public readonly fallbackHandler?: FallbackHandlerInfoDto;
}

/**
 * DTO for full contract analysis response.
 *
 * This DTO mirrors GroupedAnalysisResults<ContractAnalysisResult> for Swagger documentation.
 * Results are grouped by status group and sorted by severity (CRITICAL first).
 * Used by endpoints that return contract verification, interaction, and delegatecall analysis.
 */
export class ContractAnalysisDto implements GroupedAnalysisResults<ContractAnalysisResult> {
  @ApiPropertyOptional({
    description: 'Logo URL for the contract',
    example: 'https://example.com/logo.png',
  })
  public readonly logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Name of the contract',
    example: 'Uniswap V3 Router',
  })
  public readonly name?: string;

  @ApiPropertyOptional({
    description:
      'Analysis results for contract verification status. ' +
      'Shows whether contracts are verified and source code is available.',
    type: [ContractAnalysisResultDto],
    example: [
      {
        severity: 'INFO',
        type: 'VERIFIED',
        title: 'Verified contract',
        description:
          'This contract has been verified and its source code is available',
      },
    ],
  })
  public readonly [ContractStatusGroup.CONTRACT_VERIFICATION]?: Array<ContractAnalysisResultDto>;

  @ApiPropertyOptional({
    description:
      'Analysis results related to contract interaction history. ' +
      'Shows whether this is a new or previously interacted contract.',
    type: [ContractAnalysisResultDto],
    example: [
      {
        severity: 'INFO',
        type: 'NEW_CONTRACT',
        title: 'New contract',
        description:
          'This is the first time you are interacting with this contract',
      },
    ],
  })
  public readonly [ContractStatusGroup.CONTRACT_INTERACTION]?: Array<ContractAnalysisResultDto>;

  @ApiPropertyOptional({
    description:
      'Analysis results for delegatecall operations. ' +
      'Identifies unexpected or potentially dangerous delegate calls.',
    type: [ContractAnalysisResultDto],
    example: [
      {
        severity: 'CRITICAL',
        type: 'UNEXPECTED_DELEGATECALL',
        title: 'Unexpected delegatecall',
        description:
          'An unexpected delegatecall operation was detected that could be dangerous',
      },
    ],
  })
  public readonly [ContractStatusGroup.DELEGATECALL]?: Array<ContractAnalysisResultDto>;

  @ApiPropertyOptional({
    description:
      'Analysis results for setFallbackHandler operations. ' +
      'Identifies untrusted or unofficial fallback handlers in the transactions.',
    type: [FallbackHandlerAnalysisResultDto],
    example: [
      {
        severity: 'WARN',
        type: 'UNOFFICIAL_FALLBACK_HANDLER',
        title: 'Unofficial fallback handler',
        description:
          'Verify the fallback handler is trusted and secure before proceeding.',
        fallbackHandler: {
          address: '0x123',
          name: 'CompatibilityFallbackHandler',
          logoUrl: 'https://example.com/logo.png',
        },
      },
    ],
  })
  public readonly [ContractStatusGroup.FALLBACK_HANDLER]?: Array<FallbackHandlerAnalysisResultDto>;
}

/**
 * DTO for full recipient analysis result.
 */
export class RecipientResultDto extends AnalysisResultDto<
  RecipientStatus | BridgeStatus | CommonStatus
> {
  @ApiProperty({
    description: 'Bridge compatibility status code',
    enum: [
      ...Object.values(RecipientStatus),
      ...Object.values(BridgeStatus),
      ...Object.values(CommonStatus),
    ],
    example: 'MISSING_OWNERSHIP',
  })
  declare type: RecipientStatus | BridgeStatus | CommonStatus;

  @ApiPropertyOptional({
    description:
      'Target chain ID for bridge operations. Only present for BridgeStatus.',
  })
  public readonly targetChainId?: string;
}

/**
 * DTO for full recipient analysis response.
 *
 * This DTO represents the structure for Swagger documentation.
 * Results are grouped by status group and sorted by severity (CRITICAL first).
 * Used by endpoints that return both recipient interaction and bridge analysis.
 */
export class RecipientAnalysisDto implements GroupedAnalysisResults<RecipientAnalysisResult> {
  @ApiProperty({
    description: 'Indicates whether the analyzed recipient address is a Safe.',
    example: true,
  })
  public readonly isSafe!: boolean;

  @ApiPropertyOptional({
    description:
      'Analysis results related to recipient interaction history. ' +
      'Shows whether this is a new or recurring recipient.',
    type: [RecipientResultDto],
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
  public readonly [RecipientStatusGroup.RECIPIENT_INTERACTION]?: Array<RecipientResultDto>;

  @ApiPropertyOptional({
    description:
      'Analysis results related to recipient activity frequency. ' +
      'Shows whether this is a low activity recipient.',
    type: [RecipientResultDto],
    example: [
      {
        severity: 'WARN',
        type: 'LOW_ACTIVITY',
        title: 'Low activity recipient',
        description: 'This address has few transactions.',
      },
    ],
  })
  public readonly [RecipientStatusGroup.RECIPIENT_ACTIVITY]?: Array<RecipientResultDto>;

  @ApiPropertyOptional({
    description:
      'Analysis results for cross-chain bridge operations. ' +
      'Identifies compatibility issues, ownership problems, or unsupported networks.',
    type: [RecipientResultDto],
    example: [
      {
        severity: 'WARN',
        type: 'MISSING_OWNERSHIP',
        title: 'No ownership on target chain',
        description: 'You do not have ownership of a Safe on the target chain.',
        targetChainId: '137',
      },
    ],
  })
  public readonly [RecipientStatusGroup.BRIDGE]?: Array<RecipientResultDto>;
}

/**
 * DTO for counterparty analysis response.
 *
 * Combines recipient and contract analysis results for a transaction simulation.
 * Maps addresses to their respective analysis results grouped by status group.
 */
@ApiExtraModels(
  RecipientAnalysisDto,
  ContractAnalysisDto,
  FallbackHandlerAnalysisResultDto,
  FallbackHandlerInfoDto,
)
export class CounterpartyAnalysisDto implements CounterpartyAnalysisResponse {
  @ApiProperty({
    description:
      'Recipient analysis results mapped by address. ' +
      'Contains recipient interaction history and bridge analysis.' +
      'type: Record<Address, RecipientAnalysisDto>.',
    type: Object,
    additionalProperties: {
      $ref: getSchemaPath(RecipientAnalysisDto),
    },
    example: {
      '0x0000000000000000000000000000000000000000': {
        isSafe: true,
        RECIPIENT_INTERACTION: [
          {
            severity: 'INFO',
            type: 'NEW_RECIPIENT',
            title: 'New recipient',
            description:
              'This is the first time you are interacting with this recipient',
          },
        ],
      },
    },
  })
  public readonly recipient!: Record<
    Address,
    Partial<RecipientAnalysisDto> & { isSafe: boolean }
  >;

  @ApiProperty({
    description:
      'Contract analysis results mapped by address. ' +
      'Contains contract verification, interaction history, and delegatecall analysis.' +
      'type: Record<Address, ContractAnalysisDto>.',
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(ContractAnalysisDto),
    },
    example: {
      '0x0000000000000000000000000000000000000000': {
        CONTRACT_VERIFICATION: [
          {
            severity: 'INFO',
            type: 'VERIFIED',
            title: 'Verified contract',
            description:
              'This contract has been verified and its source code is available',
          },
        ],
      },
    },
  })
  public readonly contract!: Record<Address, Partial<ContractAnalysisDto>>;
}
