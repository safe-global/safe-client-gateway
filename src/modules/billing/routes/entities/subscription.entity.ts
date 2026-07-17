// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import type { Subscription as DomainSubscription } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionStatuses } from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionPlan } from '@/modules/billing/routes/entities/plan.entity';

export class Subscription implements DomainSubscription {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  customerId!: string;
  @ApiProperty()
  upstreamCustomerId!: string;
  @ApiProperty({ type: SubscriptionPlan })
  plan!: SubscriptionPlan;
  @ApiProperty({ enum: SubscriptionStatuses })
  status!: (typeof SubscriptionStatuses)[number];
  @ApiProperty()
  createdAt!: number;
  @ApiProperty()
  startAt!: number;
  @ApiProperty({ type: Number, nullable: true })
  cancelledAt!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  cancelAt!: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  validUntil?: number | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata?: StripeMetadata | null;
}
