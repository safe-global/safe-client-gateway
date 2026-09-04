// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Address, Hex } from 'viem';
import {
  type CloudCosignerReview,
  PolicyRule,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';

export class CloudCosignerReviewDto
  implements
    Omit<CloudCosignerReview, 'id' | 'signature' | 'createdAt' | 'updatedAt'>
{
  @ApiProperty({ type: String })
  public readonly chainId!: string;

  @ApiProperty({ type: String })
  public readonly safeAddress!: Address;

  @ApiProperty({ type: String })
  public readonly safeTxHash!: Hex;

  @ApiProperty({ enum: ReviewStatus })
  public readonly status!: ReviewStatus;

  @ApiProperty({ enum: ReviewMode, nullable: true })
  public readonly mode!: ReviewMode | null;

  @ApiProperty({ enum: PolicyRule, isArray: true })
  public readonly triggeredRules!: Array<PolicyRule>;

  @ApiProperty({ type: String, nullable: true })
  public readonly summary!: string | null;

  @ApiProperty({ type: String, isArray: true })
  public readonly riskFlags!: Array<string>;

  @ApiProperty({ type: String, nullable: true })
  public readonly model!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  public readonly reviewedAt!: string;

  public static fromDomain(
    review: CloudCosignerReview,
  ): CloudCosignerReviewDto {
    return {
      chainId: review.chainId,
      safeAddress: review.safeAddress,
      safeTxHash: review.safeTxHash,
      status: review.status,
      mode: review.mode,
      triggeredRules: review.triggeredRules,
      summary: review.summary,
      riskFlags: review.riskFlags,
      model: review.model,
      reviewedAt: review.updatedAt.toISOString(),
    };
  }
}
