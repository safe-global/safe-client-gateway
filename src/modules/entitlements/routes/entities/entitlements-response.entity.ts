// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';

export class EntitlementsPlan {
  @ApiProperty({ description: 'Plan identifier in the billing service' })
  public readonly id!: string;

  @ApiProperty({ type: String, nullable: true })
  public readonly name!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'End of the current billing cycle',
  })
  public readonly cycleEndsAt!: string | null;
}

export class EntitlementItem {
  @ApiProperty({
    type: String,
    description:
      'Feature key from the entitlements catalog. Data-driven, not a fixed enum: the catalog can grow without a contract change.',
  })
  public readonly feature!: FeatureKey;

  @ApiProperty({ enum: FeatureType, enumName: 'FeatureType' })
  public readonly type!: FeatureType;

  @ApiProperty()
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
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Metered only. Null for stock-type features (seats) that have no reset window.',
  })
  public readonly resetsAt?: string | null;

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
