// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import {
  type FeatureKey,
  FeatureKeys,
} from '@/modules/entitlements/domain/entities/feature.entity';

/**
 * Stable `code` values surfaced in the 402 body so the frontend can branch
 * on them. New codes can be added here without touching call sites.
 */
export const ENTITLEMENTS_ERROR_CODES = ['QUOTA_EXCEEDED'] as const;
export type EntitlementsErrorCode = (typeof ENTITLEMENTS_ERROR_CODES)[number];

export class QuotaExceededErrorResponse {
  @ApiProperty({
    enum: ENTITLEMENTS_ERROR_CODES,
    description:
      'Stable identifier of the error condition. The frontend MUST branch on this value (not on `message`, which is informational and may change).',
  })
  public readonly code!: EntitlementsErrorCode;

  @ApiProperty({
    description:
      'Human-readable description of the error. Informational only; do not parse.',
  })
  public readonly message!: string;

  @ApiProperty({ example: 402 })
  public readonly statusCode!: number;

  @ApiProperty({ enum: FeatureKeys, enumName: 'FeatureKey' })
  public readonly feature!: FeatureKey;

  @ApiProperty({ description: "The plan's quota for the feature" })
  public readonly quota!: number;

  @ApiProperty({ description: 'Current usage' })
  public readonly used!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'When the quota resets; null for stock-type features (no window).',
  })
  public readonly resetsAt!: string | null;
}
