// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import {
  FEATURE_KEYS,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type {
  ResolvedBinaryEntitlement,
  ResolvedMeteredEntitlement,
  ResolvedValueEntitlement,
} from '@/modules/entitlements/domain/entities/resolved-entitlements.entity';

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

class EntitlementItemBase {
  @ApiProperty({
    enum: FEATURE_KEYS,
    enumName: 'FeatureKey',
    description: 'Feature key from the entitlements catalog.',
  })
  public readonly feature!: FeatureKey;

  @ApiProperty({
    description:
      'Whether the plan grants the feature at all. A metered feature reports its quota and usage even when this is false.',
  })
  public readonly enabled!: boolean;
}

/** A feature that is only ever on or off. */
export class BinaryEntitlement
  extends EntitlementItemBase
  implements ResolvedBinaryEntitlement
{
  @ApiProperty({ enum: [FeatureType.Binary] })
  public readonly type!: FeatureType.Binary;
}

/** A feature whose grant is a value, e.g. a fee tier. */
export class ValueEntitlement
  extends EntitlementItemBase
  implements ResolvedValueEntitlement
{
  @ApiProperty({ enum: [FeatureType.Value] })
  public readonly type!: FeatureType.Value;

  @ApiProperty({ type: String, nullable: true })
  public readonly value!: string | null;
}

/** A feature with a quota and usage measured against it. */
export class MeteredEntitlement
  extends EntitlementItemBase
  implements ResolvedMeteredEntitlement
{
  @ApiProperty({ enum: [FeatureType.Metered] })
  public readonly type!: FeatureType.Metered;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "The plan's quota, never inflated to match usage; null means unlimited.",
  })
  public readonly quota!: number | null;

  @ApiProperty({ description: 'May legally exceed `quota`.' })
  public readonly used!: number;

  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      'Null for stock-type features (seats) that have no reset window.',
  })
  public readonly resetsAt!: Date | null;
}

export type EntitlementItem =
  | BinaryEntitlement
  | ValueEntitlement
  | MeteredEntitlement;

@ApiExtraModels(BinaryEntitlement, ValueEntitlement, MeteredEntitlement)
export class EntitlementsResponse {
  @ApiProperty({
    type: EntitlementsPlan,
    nullable: true,
    description: 'Null when the workspace has no active subscription.',
  })
  public readonly plan!: EntitlementsPlan | null;

  @ApiProperty({
    description:
      'One entry per catalog feature. Which fields an entry carries is decided by `type`: a metered one always carries quota, usage and its reset window, and the others never do.',
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(BinaryEntitlement) },
        { $ref: getSchemaPath(ValueEntitlement) },
        { $ref: getSchemaPath(MeteredEntitlement) },
      ],
      discriminator: {
        propertyName: 'type',
        // The wire values are not the schema names, so the mapping cannot be
        // implicit — without it a generated SDK cannot resolve the variant.
        mapping: {
          [FeatureType.Binary]: getSchemaPath(BinaryEntitlement),
          [FeatureType.Value]: getSchemaPath(ValueEntitlement),
          [FeatureType.Metered]: getSchemaPath(MeteredEntitlement),
        },
      },
    },
  })
  public readonly entitlements!: Array<EntitlementItem>;
}
