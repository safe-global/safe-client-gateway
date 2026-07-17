// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { StripeMetadata } from '@/datasources/billing-api/entities/metadata.entity';
import type {
  PaymentLink as DomainPaymentLink,
  PaymentLinkLineItem,
} from '@/datasources/billing-api/entities/payment-link.entity';

export class PaymentLink implements DomainPaymentLink {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  url!: string;
  @ApiProperty()
  active!: boolean;
  @ApiProperty({ type: Object })
  metadata!: StripeMetadata;
  @ApiPropertyOptional({ type: Object })
  customText?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object })
  afterCompletion?: Record<string, unknown>;
  @ApiPropertyOptional({ type: [Object] })
  lineItems?: Array<PaymentLinkLineItem>;
}
