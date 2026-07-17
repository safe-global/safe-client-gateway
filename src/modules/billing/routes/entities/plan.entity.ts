// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import type {
  MarketingFeature as DomainMarketingFeature,
  Plan as DomainPlan,
  Product as DomainProduct,
  SubscriptionPlan as DomainSubscriptionPlan,
} from '@/datasources/billing-api/entities/plan.entity';
import {
  PlanBillingCycles,
  PlanCurrencies,
  PlanTypes,
} from '@/datasources/billing-api/entities/plan.entity';

export class MarketingFeature implements DomainMarketingFeature {
  @ApiProperty()
  name!: string;
}

export class Product implements DomainProduct {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  active!: boolean;
  @ApiProperty()
  description!: string;
  @ApiProperty({ type: MarketingFeature, isArray: true })
  marketingFeatures!: Array<MarketingFeature>;
  @ApiProperty({ type: Object })
  metadata!: StripeMetadata;
  @ApiProperty()
  name!: string;
}

class BasePlan {
  @ApiProperty()
  id!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;
  @ApiProperty()
  currentPrice!: number;
  @ApiProperty({ type: Number, nullable: true })
  originalPrice!: number | null;
  @ApiProperty({ enum: ['fiat'] })
  paymentMethod!: 'fiat';
  @ApiProperty({ enum: PlanCurrencies })
  currency!: (typeof PlanCurrencies)[number];
  @ApiProperty({ type: [String] })
  features!: Array<string>;
  @ApiPropertyOptional({ enum: PlanBillingCycles, nullable: true })
  billingCycle?: (typeof PlanBillingCycles)[number] | null;
  @ApiProperty({ enum: PlanTypes })
  type!: (typeof PlanTypes)[number];
}

// As embedded in a Subscription: the product is referenced by ID only.
export class SubscriptionPlan
  extends BasePlan
  implements DomainSubscriptionPlan
{
  @ApiProperty({ type: String, nullable: true })
  product!: string | null;
}

// As returned by GET /plans and GET /plans/{planId}: the full product object.
export class Plan extends BasePlan implements DomainPlan {
  @ApiProperty({ type: Product })
  product!: Product;
}
