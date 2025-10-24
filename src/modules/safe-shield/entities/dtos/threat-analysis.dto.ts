import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { AnalysisResultDto } from './analysis-result.dto';
import {
  CommonStatus,
  MaliciousOrModerateThreatAnalysisResult,
  MasterCopyChangeThreatAnalysisResult,
  ThreatAnalysisResult,
} from '../analysis-result.entity';
import { ThreatStatus } from '../threat-status.entity';
import { Severity } from '../severity.entity';
import type { ThreatAnalysisResponse } from '../analysis-responses.entity';
import {
  AssetDetails,
  AssetType,
  AssetTypeSchema,
  BalanceChange,
  FungibleDiffSchema,
  NFTDiffSchema,
} from '../threat-analysis.types';
import { Address } from 'viem';
import type { z } from 'zod';

/**
 * DTO for master copy change threat analysis result.
 */
export class MasterCopyChangeThreatAnalysisResultDto
  extends AnalysisResultDto<'MASTERCOPY_CHANGE'>
  implements MasterCopyChangeThreatAnalysisResult
{
  @ApiProperty({
    description: 'Threat status code',
    enum: ['MASTERCOPY_CHANGE'],
  })
  type!: 'MASTERCOPY_CHANGE';

  @ApiProperty({
    description: 'Address of the old master copy/implementation contract',
  })
  before!: string;

  @ApiProperty({
    description: 'Address of the new master copy/implementation contract',
  })
  after!: string;
}

/**
 * DTO for malicious or moderate threat analysis result.
 */
export class MaliciousOrModerateThreatAnalysisResultDto
  extends AnalysisResultDto<'MALICIOUS' | 'MODERATE'>
  implements MaliciousOrModerateThreatAnalysisResult
{
  @ApiProperty({
    description: 'Threat status code',
    enum: ['MALICIOUS', 'MODERATE'],
  })
  type!: 'MALICIOUS' | 'MODERATE';

  @ApiPropertyOptional({
    description:
      'A partial record of specific issues identified during threat analysis, grouped by severity.' +
      'Record<Severity, string[]> - keys should be one of the Severity enum.',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: {
      CRITICAL: ['Malicious contract interaction detected'],
      WARN: ['High gas price detected'],
    },
  })
  issues?: Partial<Record<keyof typeof Severity, Array<string>>>;
}

/**
 * DTO for generic threat analysis result.
 */
export class ThreatAnalysisResultDto extends AnalysisResultDto<
  ThreatStatus | CommonStatus
> {
  @ApiProperty({
    description: 'Threat status code',
    enum: [...ThreatStatus, ...CommonStatus],
  })
  type!: ThreatStatus | CommonStatus;
}

/**
 * DTO for asset details in balance changes.
 */
export class AssetDetailsDto implements AssetDetails {
  @ApiProperty({
    description: 'Asset type',
    enum: AssetTypeSchema.options,
  })
  type!: AssetType;

  @ApiPropertyOptional({
    description: 'Token symbol (if available)',
  })
  symbol?: string;

  @ApiProperty({
    description: 'Token contract address',
  })
  address!: Address;

  @ApiPropertyOptional({
    description: 'URL to asset logo (if available)',
    example: 'https://example.com/usdc-logo.png',
  })
  logo_url?: string;
}

/**
 * DTO for fungible asset difference.
 */
export class FungibleDiffDto implements z.infer<typeof FungibleDiffSchema> {
  @ApiPropertyOptional({
    description: 'Value change for fungible tokens',
    example: '1000000',
  })
  value?: string;
}

/**
 * DTO for NFT asset difference.
 */
export class NFTDiffDto implements z.infer<typeof NFTDiffSchema> {
  @ApiProperty({
    description: 'Token ID for NFTs',
    example: 42,
  })
  token_id!: number;
}

/**
 * DTO for balance change of a single asset.
 */
@ApiExtraModels(FungibleDiffDto, NFTDiffDto)
export class BalanceChangeDto implements BalanceChange {
  @ApiProperty({
    description: 'Asset details',
    type: AssetDetailsDto,
  })
  asset!: AssetDetailsDto;

  @ApiProperty({
    description: 'Incoming asset changes',
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(FungibleDiffDto) },
        { $ref: getSchemaPath(NFTDiffDto) },
      ],
    },
    example: [{ value: '1000000' }],
  })
  in!: Array<FungibleDiffDto | NFTDiffDto>;

  @ApiProperty({
    description: 'Outgoing asset changes',
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(FungibleDiffDto) },
        { $ref: getSchemaPath(NFTDiffDto) },
      ],
    },
    example: [{ value: '500000' }],
  })
  out!: Array<FungibleDiffDto | NFTDiffDto>;
}

/**
 * DTO for threat analysis response.
 *
 * Returns threat analysis results grouped by category along with balance changes.
 * Unlike recipient/contract analysis, threat analysis operates at the
 * transaction level rather than per-address.
 */
@ApiExtraModels(
  ThreatAnalysisResultDto,
  MasterCopyChangeThreatAnalysisResultDto,
  MaliciousOrModerateThreatAnalysisResultDto,
)
export class ThreatAnalysisResponseDto implements ThreatAnalysisResponse {
  @ApiPropertyOptional({
    description:
      'Array of threat analysis results. ' +
      'Results are sorted by severity (CRITICAL first). ' +
      'May include malicious patterns, ownership changes, module changes, or master copy upgrades.',
    oneOf: [
      { $ref: getSchemaPath(ThreatAnalysisResultDto) },
      { $ref: getSchemaPath(MasterCopyChangeThreatAnalysisResultDto) },
      { $ref: getSchemaPath(MaliciousOrModerateThreatAnalysisResultDto) },
    ],
    isArray: true,
    example: [
      {
        severity: 'OK',
        type: 'NO_THREAT',
        title: 'No threats detected',
        description: 'Transaction analysis found no security threats',
      },
    ],
  })
  THREAT?: Array<ThreatAnalysisResult>;

  @ApiPropertyOptional({
    description:
      'Balance changes resulting from the transaction. ' +
      'Shows incoming and outgoing transfers for various asset types.',
    type: [BalanceChangeDto],
    example: [
      {
        asset: {
          type: 'ERC20',
          symbol: 'USDC',
          address: '0x0000000000000000000000000000000000000000',
          logo_url: 'https://example.com/usdc-logo.png',
        },
        in: [{ value: '1000000' }],
        out: [{ value: '500000' }],
      },
    ],
  })
  BALANCE_CHANGE?: Array<BalanceChange>;
}
