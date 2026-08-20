// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import {
  FEATURE_KEYS,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';

export class EntitlementsPlan {
  @ApiProperty({ description: 'Plan identifier in the billing service' })
  public readonly id!: string;

  @ApiProperty({ type: String, nullable: true })
  public readonly name!: string | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'End of the current billing cycle',
  })
  public readonly cycleEndsAt!: Date | null;
}

export class EntitlementItem {
  @ApiProperty({
    enum: FEATURE_KEYS,
    enumName: 'FeatureKey',
    description: 'Feature key from the entitlements catalog.',
  })
  public readonly feature!: FeatureKey;

  @ApiProperty({ enum: FeatureType, enumName: 'FeatureType' })
  public readonly type!: FeatureType;

  @ApiProperty({
    description:
      'Whether the plan grants the feature at all. The metered fields below are still reported when it is false — a workspace that holds more than a disabled feature allows is over its limit, and that is what the enforcement layer acts on.',
  })
  public readonly enabled!: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      "Metered only. The plan's quota (never inflated to match usage); null = unlimited.",
  })
  public readonly quota?: number | null;

  @ApiPropertyOptional({
    type: Number,
    description: 'Metered only. May legally exceed `quota`.',
  })
  public readonly used?: number;

  @ApiPropertyOptional({
    description:
      'Metered only. True once `used` has passed `quota`; never true for an unlimited quota. The over-limit state lasts until usage drops or the plan is upgraded, and it is reported here only — the blocking itself happens on the mutations.',
  })
  public readonly overLimit?: boolean;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description:
      'Metered only. Null for stock-type features (seats) that have no reset window.',
  })
  public readonly resetsAt?: Date | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Value-typed only (e.g. fee tiers).',
  })
  public readonly value?: string | null;
}

export class EntitlementsResponse {
  @ApiProperty({
    type: EntitlementsPlan,
    nullable: true,
    description: 'Null when the workspace is on the Free plan.',
  })
  public readonly plan!: EntitlementsPlan | null;

  @ApiProperty({ type: EntitlementItem, isArray: true })
  public readonly entitlements!: Array<EntitlementItem>;
}
