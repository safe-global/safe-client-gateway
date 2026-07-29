// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type FeatureKey,
  FeatureKeys,
  type FeatureType,
  FeatureTypes,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';

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
  @ApiProperty({ enum: FeatureKeys, enumName: 'FeatureKey' })
  public readonly feature!: FeatureKey;

  @ApiProperty({ enum: FeatureTypes, enumName: 'FeatureType' })
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
      'Metered only. Null for stock-type features (seats, members) that have no reset window.',
  })
  public readonly resetsAt?: string | null;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Metered only. True when the workspace is over quota because it pre-dates enforcement and never purchased a plan: nothing degrades, only new additions block.',
  })
  public readonly grandfathered?: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Value-typed only (e.g. fee tiers).',
  })
  public readonly value?: string | null;
}

export class OverSeatSafe {
  @ApiProperty({ type: String })
  public readonly chainId!: SpaceSafe['chainId'];

  @ApiProperty({ type: String })
  public readonly address!: SpaceSafe['address'];
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

  @ApiProperty({
    type: OverSeatSafe,
    isArray: true,
    description:
      'Safes losing the org layer while the workspace is over its seat quota (name/address/balance stay visible). Always empty for grandfathered workspaces.',
  })
  public readonly overSeatSafes!: Array<OverSeatSafe>;
}
